/**
 * 汽车之家搜索服务
 * 
 * 技术实现:
 * 1. 搜索 API: sou.api.autohome.com.cn/v1/search (无需 Cookie)
 * 2. 正文获取：Playwright 打开帖子 URL，使用 .fn-main .post 选择器提取
 * 
 * 注意：
 * - 搜索 API 无需 Cookie 即可调用
 * - 正文提取使用精准选择器 .fn-main .post（已验证）
 * - 默认获取前 2 条帖子的正文（约 8-12 秒）
 * 
 * 优化点：
 * - ✅ 配置集中管理（延迟、重试、超时）
 * - ✅ 智能错误处理（错误分类、自动重试）
 * - ✅ 页面监控（选择器失效警告，1 小时去重）
 * - ✅ 并发控制（默认 2 个并发，降低资源占用）
 * - ✅ 超时控制（20 秒页面加载，25 秒总超时）
 */

import { ISearchPlatform, SearchResult } from './platform-base';
import { getLogger } from '../../utils/logger';
import { spawn } from 'child_process';
import path from 'path';
import { loadConfig } from '../../utils/config';
import { NetworkPostConfigStorage } from '../../storage/mysql/network-post-config-storage';

const logger = getLogger('autohome-search');

/**
 * 错误类型枚举
 */
enum AutohomeErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  SELECTOR_NOT_FOUND = 'SELECTOR_NOT_FOUND',
  PAGE_STRUCTURE_CHANGED = 'PAGE_STRUCTURE_CHANGED',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 错误分类结果
 */
interface AutohomeError {
  type: AutohomeErrorType;
  message: string;
  shouldRetry: boolean;
}

/**
 * 配置接口
 */
interface AutohomeConfig {
  // 延迟控制
  searchDelayMin: number;
  searchDelayMax: number;
  pageDelayMin: number;
  pageDelayMax: number;
  
  // 重试机制
  maxRetries: number;
  retryDelay: number;
  retryBackoff: number;
  
  // 超时控制
  requestTimeout: number;
  pageLoadTimeout: number;
  
  // 并发控制
  maxConcurrent: number;
  
  // 频率限制
  maxRequestsPerHour: number;
  
  // 其他
  maxResults: number;
}

/**
 * 汽车之家搜索结果
 */
interface AutohomePost {
  title: string;
  url: string;
  author: string;
  replies: number;
  views: number;
  publish_time?: string;
  images?: string[];
  content?: string;
  content_images?: string[];
}

/**
 * 汽车之家搜索服务类
 */
export class AutohomeSearch implements ISearchPlatform {
  private config: AutohomeConfig;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestTimestamps: number[] = []; // 滑动窗口时间戳

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * 初始化（异步加载配置）
   */
  async initialize(): Promise<void> {
    try {
      // 从数据库加载配置
      const storage = NetworkPostConfigStorage.getInstance();
      const config = await storage.getConfig();
      
      if (config && config.autohomeCookie) {
        // 汽车之家目前无需 Cookie，但预留接口
        logger.info('[AutohomeSearch] 配置加载成功');
      } else {
        logger.info('[AutohomeSearch] 使用默认配置（汽车之家无需 Cookie）');
      }
    } catch (error) {
      logger.error('[AutohomeSearch] 加载配置失败:', error);
    }
  }

  /**
   * 加载配置
   */
  private loadConfig(): AutohomeConfig {
    const config = loadConfig();
    return {
      // 保守模式 - 降低风控风险
      searchDelayMin: 2000,     // 2 秒
      searchDelayMax: 5000,     // 5 秒
      pageDelayMin: 3000,       // 3 秒
      pageDelayMax: 6000,       // 6 秒
      
      // 重试机制
      maxRetries: 2,
      retryDelay: 3000,         // 3 秒
      retryBackoff: 1.5,
      
      // 超时控制
      requestTimeout: 30000,
      pageLoadTimeout: 20000,   // 20 秒
      
      // 并发控制
      maxConcurrent: 2,         // 2 个并发
      
      // 频率限制
      maxRequestsPerHour: 30,   // 每小时最多 30 次请求
      
      // 其他
      maxResults: 10,
    };
  }

  /**
   * 随机延迟
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    logger.debug(`随机延迟 ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 搜索间延迟
   */
  private async searchDelay(): Promise<void> {
    await this.randomDelay(this.config.searchDelayMin, this.config.searchDelayMax);
  }

  /**
   * 页面间延迟
   */
  private async pageDelay(): Promise<void> {
    await this.randomDelay(this.config.pageDelayMin, this.config.pageDelayMax);
  }

  /**
   * 频率限制检查（滑动窗口）
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 小时前
    
    // 移除 1 小时前的时间戳
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneHourAgo);
    
    // 检查是否超过限制
    if (this.requestTimestamps.length >= this.config.maxRequestsPerHour) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = oldestTimestamp + 3600000 - now;
      if (waitTime > 0) {
        logger.warn(`频率限制：已达到每小时 ${this.config.maxRequestsPerHour} 次请求，等待 ${Math.ceil(waitTime/1000)} 秒`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // 记录当前请求时间戳
    this.requestTimestamps.push(now);
    logger.debug(`当前小时请求数：${this.requestTimestamps.length}/${this.config.maxRequestsPerHour}`);
  }

  /**
   * 错误分类
   */
  private classifyError(error: Error, statusCode?: number): AutohomeError {
    const message = error.message.toLowerCase();
    
    // 选择器未找到
    if (message.includes('selector') || message.includes('not found')) {
      return {
        type: AutohomeErrorType.SELECTOR_NOT_FOUND,
        message: error.message,
        shouldRetry: false,
      };
    }
    
    // 页面结构变更
    if (message.includes('page structure') || message.includes('structure changed')) {
      return {
        type: AutohomeErrorType.PAGE_STRUCTURE_CHANGED,
        message: error.message,
        shouldRetry: false,
      };
    }
    
    // 频率限制
    if (message.includes('rate limit') || message.includes('too many') || statusCode === 429) {
      return {
        type: AutohomeErrorType.RATE_LIMITED,
        message: error.message,
        shouldRetry: true,
      };
    }
    
    // 超时
    if (message.includes('timeout')) {
      return {
        type: AutohomeErrorType.TIMEOUT,
        message: error.message,
        shouldRetry: true,
      };
    }
    
    // API 错误
    if (statusCode && statusCode >= 500) {
      return {
        type: AutohomeErrorType.API_ERROR,
        message: error.message,
        shouldRetry: true,
      };
    }
    
    // Cookie 过期/无效（预留）
    if (message.includes('cookie') || message.includes('unauthorized') || statusCode === 401) {
      return {
        type: AutohomeErrorType.UNKNOWN,
        message: error.message,
        shouldRetry: false,
      };
    }
    
    // 默认网络错误
    return {
      type: AutohomeErrorType.NETWORK_ERROR,
      message: error.message,
      shouldRetry: true,
    };
  }

  /**
   * 带重试的异步操作
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;
    let delay = this.config.retryDelay;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const classifiedError = this.classifyError(lastError);
        
        logger.warn(
          `${operationName} 第 ${attempt + 1} 次失败：${classifiedError.type} - ${lastError.message}`
        );
        
        // 不应该重试的错误直接抛出
        if (!classifiedError.shouldRetry) {
          logger.error(`${operationName} 失败，不重试：${classifiedError.type}`);
          throw lastError;
        }
        
        // 最后一次尝试失败
        if (attempt === this.config.maxRetries) {
          logger.error(`${operationName} 达到最大重试次数`);
          break;
        }
        
        // 指数退避
        logger.info(`${operationName} ${delay}ms 后重试第 ${attempt + 2} 次`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= this.config.retryBackoff;
      }
    }
    
    throw lastError || new Error('未知错误');
  }

  getPlatformName(): string {
    return 'autohome';
  }

  getPlatformDisplayName(): string {
    return '汽车之家';
  }

  /**
   * 搜索汽车之家帖子
   * @param keywords 搜索关键词数组
   * @param maxResults 最大结果数量
   * @returns 搜索结果数组
   */
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    const keyword = keywords.join(' ');
    logger.info(`开始搜索汽车之家："${keyword}"`);

    // 频率限制检查
    await this.checkRateLimit();
    
    // 搜索间延迟
    await this.searchDelay();
    
    const results = await this.searchViaPython(keyword, maxResults);
    logger.info(`汽车之家搜索完成，返回 ${results.length} 条结果`);
    
    if (results.length === 0) {
      throw new Error('汽车之家搜索结果为空');
    }
    
    return results;
  }

  /**
   * 通过 Python 脚本调用搜索 API + Playwright 获取帖子内容
   */
  private async searchViaPython(keyword: string, maxResults: number): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../../../scripts/test_autohome.py');
      const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';

      // 使用 --fetch-content 参数获取正文（默认并发 2 条）
      const args = [scriptPath, keyword, String(maxResults), '--fetch-content'];

      const pyProcess = spawn(pythonExecutable, args);
      let output = '';
      let errorOutput = '';
      let settled = false;

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
          logger.warn(`Python 脚本退出码：${code}, 错误：${errorOutput}`);
          resolve([]);
          return;
        }

        try {
          const result = JSON.parse(output);
          if (!result.success) {
            logger.warn(`搜索失败：${result.error}`);
            resolve([]);
            return;
          }

          const results: SearchResult[] = (result.results || []).map((item: any) => ({
            title: item.title || '无标题',
            content: item.content || '',
            source: '汽车之家',
            url: item.url || '',
            author: item.author || '未知用户',
            likes: item.views || 0,
            comments: item.replies || 0,
            imageUrls: item.images || [],
            publishTime: item.publish_time || undefined,
          }));

          const withContentCount = results.filter(r => r.content).length;
          logger.info(`汽车之家搜索完成，返回 ${results.length} 条结果，${withContentCount} 条含正文`);
          resolve(results);

        } catch (e) {
          logger.error(`解析响应失败：${e}, output: ${output}`);
          resolve([]);
        }
      });

      // 超时处理（25 秒）
      setTimeout(() => {
        if (settled) return;
        settled = true;
        pyProcess.kill();
        logger.warn('搜索超时（25 秒）');
        resolve([]);
      }, 25000);
    });
  }

  /**
   * 获取帖子详情（使用重试机制）
   * @param postUrl 帖子 URL
   * @returns 帖子详情
   */
  async getPostDetail(postUrl: string): Promise<{
    success: boolean;
    data?: {
      id: string;
      title: string;
      content: string;
      author: string;
      likes: number;
      comments: number;
      images: string[];
      url: string;
    };
    error?: string;
  }> {
    try {
      logger.info(`开始获取帖子详情：${postUrl}`);
      
      // 使用重试机制调用 API
      const result = await this.retryWithBackoff(
        () => this.getDetailViaPython(postUrl),
        '帖子详情 API 调用'
      );
      
      if (result.success && result.data) {
        logger.info(`帖子详情获取成功：${result.data.title}`);
        return {
          success: true,
          data: {
            id: result.data.id,
            title: result.data.title || '无标题',
            content: result.data.content || '',
            author: result.data.author || '未知用户',
            likes: result.data.likes || 0,
            comments: result.data.comments || 0,
            images: result.data.images || [],
            url: result.data.url || postUrl,
          },
        };
      } else {
        return {
          success: false,
          error: result.error || '获取详情失败',
        };
      }
    } catch (error) {
      logger.error('获取帖子详情失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取详情失败',
      };
    }
  }

  /**
   * 使用 Python 脚本获取帖子详情
   */
  private async getDetailViaPython(postUrl: string): Promise<{
    success: boolean;
    data?: {
      id: string;
      title: string;
      content: string;
      author: string;
      likes: number;
      comments: number;
      images: string[];
      url: string;
    };
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../../../scripts/test_autohome.py');
      const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';

      // 使用 --detail 参数获取单个帖子详情
      const args = [scriptPath, '--detail', postUrl];

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
        logger.debug('Python 输出:', output);
        logger.debug('Python 错误输出:', errorOutput);
        logger.debug('Python 退出码:', code);

        if (code !== 0) {
          reject(new Error(errorOutput || `Python 进程退出码：${code}`));
          return;
        }

        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject(new Error(`解析响应失败：${output}`));
        }
      });

      // 设置超时（30 秒）
      setTimeout(() => {
        pyProcess.kill();
        reject(new Error('获取详情超时（30 秒）'));
      }, 30000);
    });
  }

  /**
   * 测试连接是否有效
   */
  async testConnection(): Promise<{ success: boolean; resultCount?: number; error?: string }> {
    try {
      const results = await this.search(['奥迪'], 3);
      return {
        success: results.length > 0,
        resultCount: results.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接失败',
      };
    }
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://sou.autohome.com.cn', {
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
