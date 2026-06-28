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

const logger = getLogger('internet-reference-service');

// 查询计数（用于频率限制）
let queryCount = 0;
let lastResetTime = Date.now();

/**
 * 检查是否可以进行查询（频率限制）
 */
export async function canQuery(): Promise<boolean> {
  try {
    const config = await getInternetReferenceStorage().getConfig();
    if (!config || !config.enabled) {
      logger.debug('互联网参考服务未启用');
      return false;
    }

    // 重置计数器（每小时）
    const now = Date.now();
    if (now - lastResetTime > 3600000) {
      queryCount = 0;
      lastResetTime = now;
    }

    // 检查频率限制
    const rateLimit = config.rateLimitPerHour || 10;
    if (queryCount >= rateLimit) {
      logger.warn(`互联网参考查询频率超限：${queryCount}/${rateLimit} 次/小时`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('检查查询频率失败:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// 注意：搜索功能现在由 internetSearchManager 在服务器端直接处理
// 不再通过 AutoJS 调用手机端进行搜索

/**
 * 去除图片水印（暂未实现，直接返回原图）
 */
async function removeWatermark(imageUrls: string[]): Promise<string[]> {
  // TODO: 服务器端实现去水印逻辑
  return imageUrls;
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

    // 增加查询计数
    queryCount++;

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

    // 去水印处理（如果有图片）
    const processedResults: SearchResult[] = results;
    // for (const result of results) {
    //   if (result.imageUrls && result.imageUrls.length > 0) {
    //     const processedUrls = await removeWatermark(result.imageUrls);
    //     processedResults.push({
    //       ...result,
    //       processedImageUrls: processedUrls,
    //     });
    //   } else {
    //     processedResults.push(result);
    //   }
    // }

    logger.info(`互联网参考素材查询完成：${processedResults.length} 篇帖子`);
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
export function resetQueryCount(): void {
  queryCount = 0;
  lastResetTime = Date.now();
}
