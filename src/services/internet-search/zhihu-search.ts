/**
 * 知乎搜索服务
 * 实现方案：知乎官方数据开放平台 API + Playwright 正文提取
 * 
 * API 文档：https://developer.zhihu.com/
 * 特点：
 * - 官方 API，稳定可靠
 * - 每天免费 1000 次调用
 * - 高质量内容，专业领域覆盖
 * - Playwright 提取正文和图片（需要 Cookie 绕过安全验证）
 * 
 * 使用方法：
 * 1. 访问 https://developer.zhihu.com/ 注册
 * 2. 创建应用获取 Access Secret
 * 3. 设置环境变量 ZHIHU_ACCESS_SECRET 和 ZHIHU_COOKIE
 */

import { ISearchPlatform, SearchResult } from './platform-base';
import { getLogger } from '../../utils/logger';
import { NetworkPostConfigStorage } from '../../storage/mysql/network-post-config-storage';
import * as http from 'http';
import * as https from 'https';
import { spawn } from 'child_process';
import * as path from 'path';

const logger = getLogger('zhihu-search');

// 动态获取环境变量（避免模块加载时固定值）
const getAccessSecret = () => process.env.ZHIHU_ACCESS_SECRET || '';
const getCookie = () => process.env.ZHIHU_COOKIE || '';

// 缓存配置，避免每次搜索都查数据库
let cachedConfig: {
  accessSecret: string;
  cookie: string;
  timestamp: number;
} | null = null;

/**
 * 从数据库加载知乎配置（Access Secret + Cookie）
 * 缓存 5 分钟，避免频繁查询数据库
 */
async function loadZhihuConfig(): Promise<{ accessSecret: string; cookie: string } | null> {
  const now = Date.now();
  
  // 检查缓存是否有效（5 分钟内）
  if (cachedConfig && (now - cachedConfig.timestamp) < 5 * 60 * 1000) {
    logger.debug('使用缓存的知乎配置');
    return {
      accessSecret: cachedConfig.accessSecret,
      cookie: cachedConfig.cookie,
    };
  }
  
  try {
    const storage = NetworkPostConfigStorage.getInstance();
    const config = await storage.getConfig();
    
    if (!config) {
      logger.warn('未找到网络发帖配置');
      return null;
    }
    
    // 更新缓存
    cachedConfig = {
      accessSecret: config.zhihuAccessSecret || '',
      cookie: config.zhihuCookie || '',
      timestamp: now,
    };
    
    logger.info(`知乎配置已加载：Access Secret=${config.zhihuAccessSecret ? '已配置' : '未配置'}, Cookie=${config.zhihuCookie ? '已配置' : '未配置'}`);
    
    return {
      accessSecret: config.zhihuAccessSecret || '',
      cookie: config.zhihuCookie || '',
    };
  } catch (error) {
    logger.error('加载知乎配置失败:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export class ZhihuSearch implements ISearchPlatform {
  private platformName = 'zhihu';
  private platformDisplayName = '知乎';
  
  getPlatformName(): string {
    return this.platformName;
  }
  
  getPlatformDisplayName(): string {
    return this.platformDisplayName;
  }
  
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    try {
      logger.info(`开始搜索知乎，关键词：${keywords.join(', ')}, 最大结果数：${maxResults}`);
      
      // 从数据库加载配置
      const config = await loadZhihuConfig();
      
      if (!config || !config.accessSecret) {
        logger.warn('知乎 Access Secret 未配置，跳过搜索');
        return [];
      }
      
      if (!config.cookie) {
        logger.warn('知乎 Cookie 未配置，Playwright 可能遇到安全验证');
      }
      
      // 使用知乎官方 API + Playwright 正文提取
      // 注意：accessSecret 和 cookie 通过 stdin 传递给 Python 脚本，无需设置环境变量
      const results = await this.searchViaApiWithContent(keywords, maxResults, config.accessSecret, config.cookie);
      return results;
      
    } catch (error) {
      logger.error('知乎搜索失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  /**
   * 使用知乎官方 API + Playwright 正文提取
   * 流程：
   * 1. 调用知乎开放平台 API 获取搜索结果（含 URL）
   * 2. 使用 Python 脚本 + Playwright 打开 URL 提取正文和图片
   */
  private async searchViaApiWithContent(
    keywords: string[], 
    maxResults: number,
    accessSecret: string,
    cookie: string
  ): Promise<SearchResult[]> {
    try {
      const keyword = keywords[0];
      
      // 步骤 1：调用知乎 API 获取搜索结果
      logger.info(`步骤 1: 调用知乎 API 搜索...`);
      const searchResults = await this.searchViaApiOnly(keyword, Math.min(maxResults, 10), accessSecret);
      
      if (searchResults.length === 0) {
        logger.warn('知乎 API 搜索结果为空');
        return [];
      }
      
      // 步骤 2：使用 Playwright 提取正文和图片
      logger.info(`步骤 2: 使用 Playwright 提取 ${searchResults.length} 条内容的正文和图片...`);
      const resultsWithContent = await this.fetchContentViaPython(searchResults, accessSecret, cookie);
      
      return resultsWithContent;
      
    } catch (error) {
      logger.error('知乎搜索失败:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * 仅调用知乎 API 获取搜索结果（不含正文）
   */
  private async searchViaApiOnly(keyword: string, count: number, accessSecret: string): Promise<any[]> {
    const url = `https://developer.zhihu.com/api/v1/content/zhihu_search`;
    const timestamp = Math.floor(Date.now() / 1000);
    
    const headers: any = {
      'Authorization': `Bearer ${accessSecret}`,
      'X-Request-Timestamp': timestamp.toString(),
      'Content-Type': 'application/json',
    };
    
    const params = new URLSearchParams({
      'Query': keyword,
      'Count': count.toString(),
    });
    
    logger.info(`请求知乎 API: ${url}?${params.toString()}`);
    
    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      logger.warn(`知乎搜索失败：HTTP ${response.status}`);
      return [];
    }
    
    const data: any = await response.json();
    
    if (data.Code !== 0) {
      logger.warn(`知乎 API 返回错误：Code=${data.Code}, Message=${data.Message}`);
      return [];
    }
    
    const searchData = data.Data || {};
    const items = searchData.Items || [];
    
    logger.info(`搜索成功，找到 ${items.length} 条结果`);
    
    return items;
  }

  /**
   * 使用 Python 脚本 + Playwright 提取正文和图片
   */
  private async fetchContentViaPython(
    searchResults: any[], 
    accessSecret: string,
    cookie: string
  ): Promise<SearchResult[]> {
    return new Promise((resolve) => {
      const scriptPath = path.join(__dirname, '../../../scripts/test_zhihu_content.py');
      const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';
      
      // 准备输入数据
      const inputData = {
        accessSecret,
        results: searchResults,
        cookie, // 传递 Cookie 用于绕过安全验证
      };
      
      const pyProcess = spawn(pythonExecutable, [scriptPath, '--from-stdin']);
      let output = '';
      let errorOutput = '';
      let settled = false;

      pyProcess.stdin.write(JSON.stringify(inputData));
      pyProcess.stdin.end();

      pyProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      pyProcess.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      pyProcess.on('close', (code: number) => {
        if (settled) return;
        settled = true;

        if (code !== 0) {
          logger.warn(`Python 脚本退出码：${code}`);
          if (errorOutput) {
            logger.debug(`错误输出：${errorOutput}`);
          }
          // Fallback：只使用 API 搜索结果（无正文图片）
          resolve(this.mapToSearchResult(searchResults));
          return;
        }

        try {
          // 解析 JSON 输出（忽略日志行）
          const lines = output.split('\n');
          let jsonStr = '';
          let jsonStart = -1;
          
          // 找到最后一行 JSON（跳过日志输出）
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().startsWith('{')) {
              jsonStart = i;
              break;
            }
          }
          
          if (jsonStart >= 0) {
            jsonStr = lines.slice(jsonStart).join('\n');
          } else {
            jsonStr = output;
          }
          
          const result = JSON.parse(jsonStr);
          
          if (!result.success || !result.results) {
            logger.warn('Python 脚本返回格式错误');
            resolve(this.mapToSearchResult(searchResults));
            return;
          }

          // 映射为 SearchResult 格式
          const finalResults: SearchResult[] = result.results.map((item: any) => ({
            title: item.title || '',
            content: item.content || '',
            source: this.platformDisplayName,
            url: item.url || '',
            author: item.author || '',
            likes: item.likes || 0,
            comments: item.comments || 0,
            imageUrls: item.images || [],
            metadata: {
              contentType: item.content_type || '',
            },
          }));

          logger.info(`Playwright 提取完成，${finalResults.length} 条结果`);
          
          // 统计图片数量
          const totalImages = finalResults.reduce((sum, r) => sum + (r.imageUrls?.length || 0), 0);
          logger.info(`共提取 ${totalImages} 张图片`);
          
          resolve(finalResults);

        } catch (e) {
          logger.warn('解析 Python 脚本输出失败:', e instanceof Error ? e.message : String(e));
          logger.debug(`原始输出：${output.substring(0, 500)}`);
          resolve(this.mapToSearchResult(searchResults));
        }
      });

      // 超时处理（90 秒，给 Playwright 更多时间）
      setTimeout(() => {
        if (settled) return;
        settled = true;
        pyProcess.kill();
        logger.warn('Python 脚本执行超时，使用 Fallback 结果');
        resolve(this.mapToSearchResult(searchResults));
      }, 90000);
    });
  }

  /**
   * 将 API 搜索结果映射为 SearchResult
   */
  private mapToSearchResult(items: any[]): SearchResult[] {
    return items.map((item: any) => {
      const authorName = item.AuthorName || '';
      const authorBadgeText = item.AuthorBadgeText || '';
      let author = authorName;
      if (authorBadgeText) {
        author += ` (${authorBadgeText})`;
      }
      
      return {
        title: item.Title || '',
        content: item.ContentText || '',
        source: this.platformDisplayName,
        url: item.Url || '',
        author: author,
        likes: item.VoteUpCount || 0,
        comments: item.CommentCount || 0,
        metadata: {
          contentType: item.ContentType || '',
          contentId: item.ContentID || '',
          authorityLevel: item.AuthorityLevel || '',
          rankingScore: item.RankingScore || 0,
        },
      };
    });
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://www.zhihu.com', {
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
