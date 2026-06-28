/**
 * 汽车之家搜索服务
 * 实现方案：
 * 1. 网页爬虫（论坛、口碑）
 */

import { ISearchPlatform, SearchResult } from './platform-base';
import { getLogger } from '../../utils/logger';

const logger = getLogger('autohome-search');

export class AutohomeSearch implements ISearchPlatform {
  private platformName = 'autohome';
  private platformDisplayName = '汽车之家';
  
  getPlatformName(): string {
    return this.platformName;
  }
  
  getPlatformDisplayName(): string {
    return this.platformDisplayName;
  }
  
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    try {
      logger.info(`开始搜索汽车之家，关键词：${keywords.join(', ')}, 最大结果数：${maxResults}`);
      
      // 汽车之家没有开放 API，使用网页爬虫
      const results = await this.crawlForum(keywords, maxResults);
      
      return results;
      
    } catch (error) {
      logger.error('汽车之家搜索失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  /**
   * 爬取汽车之家论坛（暂未实现，返回空结果）
   */
  private async crawlForum(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    logger.warn('汽车之家爬虫暂未实现，返回空结果');
    return [];
    // TODO: 实现汽车之家爬虫
    // const puppeteer = require('puppeteer');
    // ...
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://www.autohome.com.cn', {
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
