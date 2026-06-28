/**
 * 汽车之家搜索服务
 * 实现方案：
 * 1. 通过 Python 脚本爬取奥迪相关论坛的帖子列表页
 * 2. 使用 requests + BeautifulSoup 解析 HTML，按关键词过滤
 * 
 * 论坛 ID 映射（奥迪相关）：
 * - 692: 奥迪A4L, 812: 奥迪Q5/Q5L, 18: 奥迪A6L
 * - 146: 奥迪A3, 159: 奥迪Q3, 3170: 奥迪Q7, 3641: 奥迪A8
 */

import { ISearchPlatform, SearchResult } from './platform-base';
import { getLogger } from '../../utils/logger';
import { spawn } from 'child_process';
import { loadConfig } from '../../utils/config';
import path from 'path';

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
      
      const results = await this.crawlForum(keyword, maxResults);
      logger.info(`汽车之家搜索完成，返回 ${results.length} 条结果`);
      
      return results;
      
    } catch (error) {
      logger.error('汽车之家搜索失败:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }
  
  /**
   * 通过 Python 脚本爬取汽车之家论坛搜索结果
   */
  private async crawlForum(keyword: string, maxResults: number): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../../../scripts/test_autohome.py');
      const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';
      
      const args = [scriptPath, keyword, maxResults.toString()];
      if (this.cookie) {
        args.push(this.cookie);
      }
      
      logger.debug(`执行 Python 脚本: ${pythonExecutable} ${args.join(' ')}`);
      
      const pyProcess = spawn(pythonExecutable, args);

      let output = '';
      let errorOutput = '';

      pyProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      pyProcess.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
        logger.warn('Python stderr:', data.toString());
      });

      pyProcess.on('close', (code: number) => {
        logger.debug('Python 退出码:', code);
        
        if (code !== 0) {
          reject(new Error(errorOutput || `Python 进程退出码：${code}`));
          return;
        }

        try {
          const result = JSON.parse(output);
          
          if (!result.success) {
            reject(new Error(result.error || '搜索失败'));
            return;
          }

          const forumResults: AutohomeForumResult[] = result.results || [];
          
          const searchResults: SearchResult[] = forumResults.map(item => ({
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

          resolve(searchResults);
        } catch (e) {
          reject(new Error(`解析响应失败：${output}`));
        }
      });

      // 设置超时
      setTimeout(() => {
        pyProcess.kill();
        reject(new Error('搜索超时（30 秒）'));
      }, 30000);
    });
  }
  
  /**
   * 测试连接是否有效
   */
  async testConnection(): Promise<{ success: boolean; resultCount?: number; error?: string }> {
    try {
      const results = await this.search(['奥迪'], 5);
      return {
        success: true,
        resultCount: results.length,
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
