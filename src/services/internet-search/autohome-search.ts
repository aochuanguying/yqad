/**
 * 汽车之家搜索服务
 * 实现方案：
 * 1. 直接调用汽车之家 Web API 获取论坛帖子
 * 2. 使用 axios 发送 HTTP 请求，解析 JSON 响应
 * 
 * 论坛 ID 映射（奥迪相关）：
 * - 692: 奥迪 A4L, 812: 奥迪 Q5/Q5L, 18: 奥迪 A6L
 * - 146: 奥迪 A3, 159: 奥迪 Q3, 3170: 奥迪 Q7, 3641: 奥迪 A8
 */

import { ISearchPlatform, SearchResult } from './platform-base';
import { getLogger } from '../../utils/logger';
import { loadConfig } from '../../utils/config';
import axios from 'axios';

const logger = getLogger('autohome-search');

// 从环境变量或配置获取 Cookie
const config = loadConfig();
const AUTOHOME_COOKIE = process.env.AUTOHOME_COOKIE || config.internetSearch?.autohomeCookie || '';

/**
 * 汽车之家论坛搜索结果
 */
interface AutohomeForumResult {
  title: string;
  content: string;
  url: string;
  author: string;
  replies: number;
  views: number;
  imageUrls: string[];
  publishTime: string;
}

export class AutohomeSearch implements ISearchPlatform {
  private platformName = 'autohome';
  private platformDisplayName = '汽车之家';
  private cookie: string;

  // 奥迪相关论坛 ID 列表
  private audiForumIds = [692, 812, 18, 146, 159, 3170, 3641];

  constructor() {
    this.cookie = AUTOHOME_COOKIE;
  }
  
  getPlatformName(): string {
    return this.platformName;
  }
  
  getPlatformDisplayName(): string {
    return this.platformDisplayName;
  }
  
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    try {
      const keyword = keywords.join(' ');
      logger.info(`开始搜索汽车之家："${keyword}"`);
      
      const results = await this.searchForum(keyword, maxResults);
      logger.info(`汽车之家搜索完成，返回 ${results.length} 条结果`);
      
      return results;
      
    } catch (error) {
      logger.error('汽车之家搜索失败:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }
  
  /**
   * 搜索汽车之家论坛
   */
  private async searchForum(keyword: string, maxResults: number): Promise<SearchResult[]> {
    try {
      // 使用汽车之家的搜索 API
      const searchUrl = 'https://www.autohome.com.cn/ask/search/';
      
      const params = new URLSearchParams();
      params.append('key', keyword);
      params.append('type', '1'); // 1=论坛搜索
      
      const response = await axios.get(searchUrl, {
        params,
        headers: {
          'Cookie': this.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/html, */*',
        },
        timeout: 15000,
      });
      
      // 解析 HTML 响应，提取搜索结果
      const forumResults = this.parseSearchResults(response.data, maxResults);
      
      return forumResults.map(item => ({
        title: item.title || '无标题',
        content: item.content || '',
        source: '汽车之家',
        url: item.url || '',
        author: item.author || '未知用户',
        likes: item.replies || 0,
        comments: item.replies || 0,
        collects: item.views || 0,
        imageUrls: item.imageUrls || [],
        publishTime: item.publishTime || undefined,
      }));
      
    } catch (error) {
      logger.error('汽车之家 API 请求失败:', error instanceof Error ? error.message : String(error));
      
      // 如果 API 失败，返回空结果但不抛出错误
      return [];
    }
  }
  
  /**
   * 解析汽车之家搜索结果的 HTML
   */
  private parseSearchResults(html: string, maxResults: number): AutohomeForumResult[] {
    // 简化的解析逻辑，实际项目中可以使用 cheerio 库
    const results: AutohomeForumResult[] = [];
    
    // 这里需要从 HTML 中提取搜索结果
    // 由于汽车之家反爬较严，建议使用官方 API 或保持手动维护
    
    logger.warn('汽车之家搜索结果解析功能待完善，当前返回空结果');
    
    return results;
  }
  
  /**
   * 测试连接是否有效
   */
  async testConnection(): Promise<{ success: boolean; resultCount?: number; error?: string }> {
    try {
      const response = await axios.get('https://www.autohome.com.cn/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 5000,
      });
      
      return {
        success: response.status === 200,
        resultCount: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接失败',
      };
    }
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
