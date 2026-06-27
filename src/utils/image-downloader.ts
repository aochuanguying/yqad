import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getLogger } from './logger';
import { loadConfig } from './config';

const logger = getLogger('image-downloader');

function getTempDir(): string {
  const config = loadConfig();
  const basePath = config.materials.processedPath || './data/materials/processed';
  return path.resolve(basePath, 'temp-images');
}
const SUPPORTED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

/**
 * 从URL列表下载图片到临时目录
 * - 最多下载9张（发帖上限）
 * - 单张超时10秒
 * - 下载失败的跳过，不影响其他图片
 * @param urls 图片URL列表
 * @returns 下载成功的本地文件路径数组
 */
export async function downloadImages(urls: string[]): Promise<string[]> {
  if (!urls || urls.length === 0) return [];

  const tempDir = getTempDir();

  // 确保临时目录存在
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 最多下载9张
  const limitedUrls = urls.slice(0, 9);
  const downloadedPaths: string[] = [];

  logger.info(`开始下载 ${limitedUrls.length} 张参考图片`);

  const downloadTasks = limitedUrls.map(async (url, index) => {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 10 * 1024 * 1024, // 10MB 限制
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
        // 跟随重定向（picsum 等服务会重定向）
        maxRedirects: 5,
      });

      // 根据 Content-Type 确定扩展名
      const contentType = String(response.headers['content-type'] || 'image/jpeg');
      const ext = SUPPORTED_TYPES[contentType.split(';')[0].trim()] || '.jpg';

      // 使用 hash 作为文件名避免冲突
      const hash = crypto.createHash('md5').update(url + index).digest('hex').substring(0, 12);
      const filename = `ref_${hash}${ext}`;
      const filePath = path.join(tempDir, filename);

      fs.writeFileSync(filePath, response.data);
      logger.info(`图片下载成功: ${filename} (${(response.data.length / 1024).toFixed(0)}KB)`);
      return filePath;
    } catch (error: any) {
      logger.warn(`图片下载失败 [${index}] ${url}: ${error.message}`);
      return null;
    }
  });

  const results = await Promise.allSettled(downloadTasks);
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      downloadedPaths.push(result.value);
    }
  }

  logger.info(`参考图片下载完成: 成功 ${downloadedPaths.length}/${limitedUrls.length} 张`);
  return downloadedPaths;
}

/**
 * 清理临时图片目录中的过期文件（超过 30 天的文件）
 */
export function cleanTempImages(): void {
  const tempDir = getTempDir();
  if (!fs.existsSync(tempDir)) return;

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 天
  try {
    const files = fs.readdirSync(tempDir);
    let cleaned = 0;
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.info(`清理过期临时图片：${cleaned} 个文件（保留 30 天内）`);
    }
  } catch (error: any) {
    logger.warn(`清理临时图片失败：${error.message}`);
  }
}
