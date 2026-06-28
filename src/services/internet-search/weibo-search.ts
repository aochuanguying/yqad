/**
 * 微博搜索服务
 * 实现方案：
 * 1. 微博开放平台 API（推荐）
 * 2. 网页爬虫
 */

import { ISearchPlatform, SearchResult } from './platform-base';
import { getLogger } from '../../utils/logger';

const logger = getLogger('weibo-search');

export class WeiboSearch implements ISearchPlatform {
  private platformName = 'weibo';
  private platformDisplayName = '微博';
  private apiBaseUrl = 'https://api.weibo.com/2';
  
  getPlatformName(): string {
    return this.platformName;
  }
  
  getPlatformDisplayName(): string {
    return this.platformDisplayName;
  }
  
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    try {
      logger.info(`开始搜索微博，关键词：${keywords.join(', ')}, 最大结果数：${maxResults}`);
      
      // 方案 1: 使用微博开放平台 API
      const results = await this.searchViaApi(keywords, maxResults);
      
      return results;
      
    } catch (error) {
      logger.error('微博搜索失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  /**
   * 使用微博开放平台 API
   * 文档：https://open.weibo.com/wiki/API 文档
   */
  private async searchViaApi(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    // 需要从配置中读取 API Token
    const accessToken = process.env.WEIBO_ACCESS_TOKEN;
    
    if (!accessToken) {
      logger.warn('未配置微博 API Token，使用降级方案');
      return this.searchFallback(keywords, maxResults);
    }
    
    const keyword = keywords[0];
    const url = `${this.apiBaseUrl}/search/topics.json`;
    
    const response = await fetch(
      `${url}?access_token=${accessToken}&q=${encodeURIComponent(keyword)}&count=${maxResults}`,
      {
        method: 'GET',
      }
    );
    
    if (!response.ok) {
      throw new Error(`微博 API 请求失败：${response.status}`);
    }
    
    const data: any = await response.json();
    
    // 转换为 SearchResult 格式
    return (data.data || []).map((item: any) => ({
      title: item.title || '',
      content: item.content || '',
      source: this.platformDisplayName,
      imageUrls: [],  // 微博搜索 API 可能不返回图片
      url: item.url || '',
      author: item.user?.screen_name || '',
      likes: item.hotwordnum || 0,
    }));
  }
  
  /**
   * 降级方案：返回空结果
   */
  private async searchFallback(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    logger.warn('微博搜索使用降级方案，返回空结果');
    return [];
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://m.weibo.cn', {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}
