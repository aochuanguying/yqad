/**
 * 图片缓存 Redis 存储
 */

import { getRedisClient } from '../../utils/redis-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('image-cache-storage');

const IMAGE_CACHE_PREFIX = 'image:cache:';
const IMAGE_CACHE_TTL = 86400 * 30; // 30 天

export interface ImageCacheData {
  url: string;
  ocrText?: string;
  description?: string;
  width?: number;
  height?: number;
  format?: string;
  cachedAt: string;
}

export class ImageCacheStorage {
  private redis = getRedisClient();

  /**
   * 保存图片缓存
   */
  async saveImageCache(url: string, data: Omit<ImageCacheData, 'url' | 'cachedAt'>): Promise<void> {
    try {
      const key = this.getImageKey(url);
      const cacheData: ImageCacheData = {
        ...data,
        url,
        cachedAt: new Date().toISOString(),
      };
      
      await this.redis.hSet(key, {
        url: cacheData.url,
        ocrText: cacheData.ocrText || '',
        description: cacheData.description || '',
        width: cacheData.width?.toString() || '',
        height: cacheData.height?.toString() || '',
        format: cacheData.format || '',
        cachedAt: cacheData.cachedAt,
      });
      
      await this.redis.expire(key, IMAGE_CACHE_TTL);
      
      logger.debug(`图片缓存已保存：${url.substring(0, 50)}...`);
    } catch (error: any) {
      logger.error(`保存图片缓存失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 获取图片缓存
   */
  async getImageCache(url: string): Promise<ImageCacheData | null> {
    try {
      const key = this.getImageKey(url);
      const data = await this.redis.hGetAll(key);
      
      if (!data || !data.url) {
        return null;
      }
      
      return {
        url: data.url,
        ocrText: data.ocrText || undefined,
        description: data.description || undefined,
        width: data.width ? parseInt(data.width) : undefined,
        height: data.height ? parseInt(data.height) : undefined,
        format: data.format || undefined,
        cachedAt: data.cachedAt,
      };
    } catch (error: any) {
      logger.error(`获取图片缓存失败：${error.message}`);
      return null;
    }
  }

  /**
   * 删除图片缓存
   */
  async deleteImageCache(url: string): Promise<void> {
    try {
      const key = this.getImageKey(url);
      await this.redis.del(key);
      logger.debug(`图片缓存已删除：${url.substring(0, 50)}...`);
    } catch (error: any) {
      logger.error(`删除图片缓存失败：${error.message}`);
    }
  }

  /**
   * 获取所有图片缓存（用于兼容旧版 loadImageCache）
   */
  async getAll(): Promise<Record<string, ImageCacheData>> {
    try {
      const keys = await this.redis.keys(`${IMAGE_CACHE_PREFIX}*`);
      const result: Record<string, ImageCacheData> = {};
      
      for (const key of keys) {
        const data = await this.redis.hGetAll(key);
        if (data && data.url) {
          result[data.url] = {
            url: data.url,
            ocrText: data.ocrText || undefined,
            description: data.description || undefined,
            width: data.width ? parseInt(data.width) : undefined,
            height: data.height ? parseInt(data.height) : undefined,
            format: data.format || undefined,
            cachedAt: data.cachedAt,
          };
        }
      }
      
      return result;
    } catch (error: any) {
      logger.error(`获取所有图片缓存失败：${error.message}`);
      return {};
    }
  }

  /**
   * 批量设置图片缓存（用于兼容旧版 saveImageCache）
   */
  async setAll(cache: Record<string, ImageCacheData>): Promise<void> {
    try {
      // 先清空旧缓存
      const keys = await this.redis.keys(`${IMAGE_CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
      
      // 批量设置新缓存
      for (const [url, data] of Object.entries(cache)) {
        await this.saveImageCache(url, {
          ocrText: data.ocrText,
          description: data.description,
          width: data.width,
          height: data.height,
          format: data.format,
        });
      }
      
      logger.debug(`批量设置 ${Object.keys(cache).length} 个图片缓存`);
    } catch (error: any) {
      logger.error(`批量设置图片缓存失败：${error.message}`);
    }
  }

  /**
   * 检查缓存是否存在
   */
  async hasCache(url: string): Promise<boolean> {
    try {
      const key = this.getImageKey(url);
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error: any) {
      logger.error(`检查缓存失败：${error.message}`);
      return false;
    }
  }

  /**
   * 生成缓存键
   */
  private getImageKey(url: string): string {
    // 使用 URL 的哈希值作为键的一部分
    const hash = this.simpleHash(url);
    return `${IMAGE_CACHE_PREFIX}${hash}`;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

let instance: ImageCacheStorage | null = null;
export const getImageCacheStorage = (): ImageCacheStorage => {
  if (!instance) instance = new ImageCacheStorage();
  return instance;
};
