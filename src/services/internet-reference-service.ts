/**
 * 互联网参考服务
 * 
 * 功能：
 * 1. 查询互联网参考素材（多平台：小红书、微博、知乎、汽车之家等）
 * 2. 频率限制控制
 * 3. 水印去除
 * 4. 平台轮询策略
 * 
 * 注意：所有搜索逻辑都在服务端完成，AutoJS 只负责发帖
 */

import { getLogger } from '../utils/logger';
import { getInternetReferenceStorage } from '../storage/mysql/internet-reference-storage';
import { internetSearchManager, SearchResult } from './internet-search';
import { XiaohongshuSearch } from './internet-search/xiaohongshu-search';
import { searchRateLimitStorage } from '../storage/redis/search-rate-limit-storage';

const logger = getLogger('internet-reference-service');

/**
 * 检查是否可以进行查询（频率限制，使用 Redis 持久化）
 */
export async function canQuery(): Promise<boolean> {
  try {
    const config = await getInternetReferenceStorage().getConfig();
    if (!config || !config.enabled) {
      logger.debug('互联网参考服务未启用');
      return false;
    }

    // 使用 Redis 存储的查询计数（自动按小时过期）
    const rateLimit = config.rateLimitPerHour || 10;
    const isExceeded = await searchRateLimitStorage.isRateLimitExceeded('global', rateLimit);
    
    if (isExceeded) {
      const currentCount = await searchRateLimitStorage.getQueryCount('global');
      logger.warn(`互联网参考查询频率超限：${currentCount}/${rateLimit} 次/小时`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('检查查询频率失败:', error instanceof Error ? error.message : String(error));
    // Redis 不可用时降级为允许查询（避免阻断核心功能）
    return true;
  }
}

// 注意：搜索功能现在由 internetSearchManager 在服务器端直接处理
// 不再通过 AutoJS 调用手机端进行搜索

/**
 * 去除图片水印
 * 
 * 策略：
 * 1. 小红书图片：去掉 URL 中的水印参数，直接获取无水印原图
 * 2. 其他平台图片：下载后用 sharp 裁剪底部水印区域（约 5%）
 */
async function removeWatermark(imageUrls: string[]): Promise<string[]> {
  if (!imageUrls || imageUrls.length === 0) {
    return [];
  }

  const processedUrls: string[] = [];

  for (const imageUrl of imageUrls) {
    try {
      if (isXiaohongshuImage(imageUrl)) {
        // 小红书图片：去掉 URL 参数获取无水印原图
        const cleanUrl = removeXiaohongshuWatermarkParams(imageUrl);
        processedUrls.push(cleanUrl);
      } else if (isZhihuImage(imageUrl)) {
        // 知乎图片：替换为原图尺寸（知乎水印在缩略图上，原图无水印）
        const cleanUrl = getZhihuOriginalImage(imageUrl);
        processedUrls.push(cleanUrl);
      } else {
        // 其他平台：下载后裁剪底部水印
        const croppedPath = await cropBottomWatermark(imageUrl);
        processedUrls.push(croppedPath || imageUrl);
      }
    } catch (error) {
      logger.warn(`去水印失败（${imageUrl}），使用原图：${error instanceof Error ? error.message : String(error)}`);
      processedUrls.push(imageUrl);
    }
  }

  const removedCount = processedUrls.filter((url, i) => url !== imageUrls[i]).length;
  if (removedCount > 0) {
    logger.info(`去水印处理完成：${removedCount}/${imageUrls.length} 张图片已处理`);
  }

  return processedUrls;
}

/**
 * 判断是否为小红书图片
 */
function isXiaohongshuImage(url: string): boolean {
  return url.includes('xhscdn.com') || url.includes('xiaohongshu.com');
}

/**
 * 判断是否为知乎图片
 */
function isZhihuImage(url: string): boolean {
  return url.includes('zhimg.com') || url.includes('pic.zhihu.com');
}

/**
 * 小红书图片去水印：去掉 URL 中的图片处理参数
 * 
 * 小红书图片 URL 格式：
 * https://sns-webpic-qc.xhscdn.com/202x/xxx.jpg?imageView2/2/w/1080/format/webp
 * https://ci.xiaohongshu.com/xxx?imageView2/2/w/1080/format/webp
 * 
 * 去掉 ? 后的参数即可获取无水印原图
 */
function removeXiaohongshuWatermarkParams(url: string): string {
  // 去掉所有查询参数（imageView2 等图片处理指令会添加水印）
  const cleanUrl = url.split('?')[0];
  return cleanUrl;
}

/**
 * 知乎图片获取原图：替换缩略图后缀为原图
 * 
 * 知乎图片格式：
 * https://pic1.zhimg.com/v2-xxx_r.jpg (原图，无水印)
 * https://pic1.zhimg.com/v2-xxx_720w.jpg (缩略图)
 * https://pic1.zhimg.com/v2-xxx_b.jpg (缩略图)
 */
function getZhihuOriginalImage(url: string): string {
  // 替换常见缩略图后缀为 _r（原图）
  return url
    .replace(/_\d+w\./, '_r.')
    .replace(/_b\./, '_r.')
    .replace(/_xl\./, '_r.');
}

/**
 * 本地裁剪底部水印（通用方案）
 * 下载图片后裁剪底部 5% 区域
 */
async function cropBottomWatermark(imageUrl: string): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const axios = (await import('axios')).default;
    const fs = (await import('fs')).default;
    const path = (await import('path')).default;
    const crypto = (await import('crypto')).default;

    // 下载图片
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxContentLength: 10 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    const imageBuffer = Buffer.from(response.data);
    
    // 获取图片元数据
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) {
      logger.warn('无法获取图片尺寸，跳过裁剪');
      return null;
    }

    // 裁剪底部 5%（水印通常在底部）
    const cropHeight = Math.floor(metadata.height * 0.95);
    const croppedBuffer = await sharp(imageBuffer)
      .extract({ left: 0, top: 0, width: metadata.width, height: cropHeight })
      .toBuffer();

    // 保存到临时目录
    const config = (await import('../utils/config')).loadConfig();
    const tempDir = path.resolve(config.materials.processedPath || './data/materials/processed', 'temp-images');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const hash = crypto.createHash('md5').update(imageUrl).digest('hex').substring(0, 12);
    const ext = path.extname(imageUrl.split('?')[0]) || '.jpg';
    const filename = `nowm_${hash}${ext}`;
    const filePath = path.join(tempDir, filename);

    fs.writeFileSync(filePath, croppedBuffer);
    logger.debug(`裁剪水印完成：${filename} (原${metadata.height}px → ${cropHeight}px)`);

    return filePath;
  } catch (error) {
    logger.warn(`裁剪水印失败：${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 查询互联网参考素材
 * 返回去水印后的参考帖子列表
 */
export async function search(): Promise<SearchResult[]> {
  try {
    logger.info('开始查询互联网参考素材...');

    // 获取配置
    const config = await getInternetReferenceStorage().getConfig();
    if (!config || !config.enabled) {
      logger.warn('互联网参考服务未启用');
      return [];
    }

    // 使用搜索关键词查询
    const keywords = config.searchKeywords || ['奥迪', '奥迪 Q5L', '奥迪用车'];
    const maxResults = config.maxResults || 5;
    
    logger.info(`使用关键词搜索：${keywords.join(', ')}, 最大结果数：${maxResults}`);
    
    // 使用搜索管理器查询（自动平台轮询）
    const results = await internetSearchManager.search(keywords, maxResults);
    
    if (!results || results.length === 0) {
      logger.warn('搜索结果为空');
      return [];
    }

    // 搜索成功后再增加全局查询计数（避免失败时浪费配额）
    await searchRateLimitStorage.incrementQueryCount('global');

    // 去水印处理（如果有图片）
    const processedResults: SearchResult[] = [];
    for (const result of results) {
      if (result.imageUrls && result.imageUrls.length > 0) {
        const processedUrls = await removeWatermark(result.imageUrls);
        processedResults.push({
          ...result,
          imageUrls: processedUrls, // 使用去水印后的图片
        });
      } else {
        processedResults.push(result);
      }
    }

    logger.info(`互联网参考素材查询完成：${processedResults.length} 篇帖子，已去水印处理`);
    return processedResults;

  } catch (error) {
    logger.error('查询互联网参考素材失败:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * 获取小红书笔记详情
 * @param noteId 笔记 ID
 * @param xsecToken 可选的 xsec_token
 */
export async function getXiaohongshuNoteDetail(
  noteId: string,
  xsecToken?: string
): Promise<{
  success: boolean;
  data?: {
    id: string;
    title: string;
    content: string;
    author: string;
    likes: number;
    collects: number;
    comments: number;
    images: string[];
    url: string;
  };
  error?: string;
}> {
  try {
    logger.info(`开始获取小红书笔记详情：${noteId}`);
    
    const xiaohongshu = new XiaohongshuSearch();
    // 确保 Cookie 已加载（独立调用时不会经过 search() 的 ensureCookieLoaded）
    await xiaohongshu.initialize();
    const result = await xiaohongshu.getNoteDetail(noteId, xsecToken);
    
    if (result.success) {
      logger.info(`笔记详情获取成功：${result.data?.title}`);
    } else {
      logger.warn(`笔记详情获取失败：${result.error}`);
    }
    
    return result;
  } catch (error) {
    logger.error('获取小红书笔记详情失败:', error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取详情失败',
    };
  }
}

/**
 * 辅助函数：休眠
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重置查询计数器（用于测试）
 */
export async function resetQueryCount(): Promise<void> {
  try {
    await searchRateLimitStorage.resetQueryCount('global');
    logger.info('查询计数器已重置');
  } catch (error) {
    logger.warn('重置查询计数器失败:', error);
  }
}
