import { getLogger } from '../../utils/logger';
import { SearchResult, ISearchPlatform } from './platform-base';
import { spawn } from 'child_process';
import { loadConfig } from '../../utils/config';
import { NetworkPostConfigStorage } from '../../storage/mysql/network-post-config-storage';

const logger = getLogger('xiaohongshu-search');

/**
 * 错误类型枚举
 */
enum XiaohongshuErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  COOKIE_EXPIRED = 'COOKIE_EXPIRED',
  NOTE_NOT_FOUND = 'NOTE_NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  SIGNATURE_ERROR = 'SIGNATURE_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 错误分类结果
 */
interface XiaohongshuError {
  type: XiaohongshuErrorType;
  message: string;
  shouldRetry: boolean;
}

/**
 * 配置接口
 */
interface XiaohongshuConfig {
  cookie: string;
  requestDelayMin: number;
  requestDelayMax: number;
  pageDelayMin: number;
  pageDelayMax: number;
  maxRetries: number;
  retryDelay: number;
  retryBackoff: number;
  requestTimeout: number;
  maxRequestsPerHour: number;
}

/**
 * 小红书搜索结果
 */
interface XiaohongshuNote {
  id: string;
  title: string;
  desc: string;
  user: {
    nickname: string;
    avatar: string;
    user_id: string;
  };
  interact_info: {
    liked_count: string;
    collected_count: string;
    comment_count: string;
  };
  note_card: {
    type: string;
    display_title: string;
  };
  cover: {
    url: string;
  };
  xsec_token: string;
  url: string;
}

/**
 * 小红书搜索服务类
 * 
 * 使用 xhshow Python 库（最新的 mns0301 签名算法）访问小红书 Web API
 * 
 * 技术细节：
 * - 使用 xhshow 生成 XYS_ 格式的签名
 * - 搜索 API: POST https://so.xiaohongshu.com/api/sns/web/v2/search/notes
 * - 详情 API: POST https://edith.xiaohongshu.com/api/sns/web/v1/feed
 * - 随机延迟模拟人工操作
 * - 指数退避重试机制
 * - 智能错误处理和频率控制
 * 
 * 优化点：
 * - ✅ 使用详情 API 替代 Playwright（快速、稳定）
 * - ✅ xsec_token 支持（详情 API 必需）
 * - ✅ 重试机制（指数退避）
 * - ✅ 智能频率控制（随机延迟）
 * - ✅ 配置集中管理
 * - ✅ 智能错误处理
 */
export class XiaohongshuSearch implements ISearchPlatform {
  private config: XiaohongshuConfig;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestTimestamps: number[] = []; // 滑动窗口时间戳

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * 初始化（异步加载 Cookie）
   */
  async initialize(): Promise<void> {
    try {
      // 从数据库加载 Cookie
      const storage = NetworkPostConfigStorage.getInstance();
      const status = await storage.getCookieStatus();
      
      if (!status.hasCookie || !status.cookie) {
        logger.warn('[XiaohongshuSearch] 数据库中没有 Cookie，请先配置 Cookie');
        return;
      }
      
      const cookie = status.cookie;
      
      // 验证 Cookie 格式（使用完整的验证逻辑）
      const validation = this.validateCookieFormat(cookie);
      if (!validation.valid) {
        logger.error(
          `[XiaohongshuSearch] Cookie 格式验证失败：缺少 ${validation.missingFields?.join(', ')} 字段`
        );
        return;
      }
      
      this.config.cookie = cookie;
      logger.info('[XiaohongshuSearch] Cookie 加载成功并验证通过');
    } catch (error) {
      logger.error('[XiaohongshuSearch] 加载 Cookie 失败:', error);
    }
  }

  /**
   * 验证 Cookie 格式
   */
  private validateCookieFormat(cookie: string): { valid: boolean; missingFields?: string[] } {
    const cookieDict: Record<string, string> = {};
    cookie.split('; ').forEach(item => {
      if (item.includes('=')) {
        const [key, value] = item.split('=', 2);
        cookieDict[key.trim()] = value.trim();
      }
    });
    
    const requiredFields = ['a1', 'web_session', 'id_token'];
    const missingFields = requiredFields.filter(field => !cookieDict[field]);
    
    if (missingFields.length > 0) {
      return { valid: false, missingFields };
    }
    
    return { valid: true };
  }

  /**
   * 加载配置
   */
  private loadConfig(): XiaohongshuConfig {
    const config = loadConfig();
    return {
      cookie: process.env.XIAOHONGSHU_COOKIE || config.internetSearch?.xiaohongshuCookie || '',
      // 保守模式 - 降低风控风险
      requestDelayMin: 8000,    // 8 秒 (原 1 秒)
      requestDelayMax: 15000,   // 15 秒 (原 3 秒)
      pageDelayMin: 20000,      // 20 秒 (原 3 秒)
      pageDelayMax: 40000,      // 40 秒 (原 5 秒)
      maxRetries: 2,            // 减少重试次数
      retryDelay: 5000,         // 5 秒
      retryBackoff: 1.5,        // 降低倍数
      requestTimeout: 30000,
      maxRequestsPerHour: 5,    // 每小时最多 5 次 (原 10 次)
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
   * 请求间延迟
   */
  private async requestDelay(): Promise<void> {
    await this.randomDelay(this.config.requestDelayMin, this.config.requestDelayMax);
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
  private classifyError(error: Error, statusCode?: number): XiaohongshuError {
    const message = error.message.toLowerCase();
    
    // Cookie 过期
    if (message.includes('cookie') || message.includes('unauthorized') || statusCode === 401) {
      return {
        type: XiaohongshuErrorType.COOKIE_EXPIRED,
        message: error.message,
        shouldRetry: false,
      };
    }
    
    // 笔记不存在
    if (message.includes('not found') || statusCode === 404) {
      return {
        type: XiaohongshuErrorType.NOTE_NOT_FOUND,
        message: error.message,
        shouldRetry: false,
      };
    }
    
    // 频率限制
    if (message.includes('rate limit') || message.includes('too many') || statusCode === 429) {
      return {
        type: XiaohongshuErrorType.RATE_LIMITED,
        message: error.message,
        shouldRetry: true,
      };
    }
    
    // 签名错误
    if (message.includes('signature') || message.includes('sign')) {
      return {
        type: XiaohongshuErrorType.SIGNATURE_ERROR,
        message: error.message,
        shouldRetry: false,
      };
    }
    
    // API 错误
    if (statusCode && statusCode >= 500) {
      return {
        type: XiaohongshuErrorType.API_ERROR,
        message: error.message,
        shouldRetry: true,
      };
    }
    
    // 默认网络错误
    return {
      type: XiaohongshuErrorType.NETWORK_ERROR,
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
    return 'xiaohongshu';
  }

  getPlatformDisplayName(): string {
    return '小红书';
  }

  /**
   * 搜索小红书笔记
   * @param keywords 搜索关键词数组
   * @param maxResults 最大结果数量
   * @returns 搜索结果数组
   */
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    const keyword = keywords.join(' ');
    logger.info(`开始搜索小红书："${keyword}"`);

    // 每次搜索前从数据库加载最新 Cookie（确保使用最新值）
    await this.ensureCookieLoaded();

    if (!this.config.cookie) {
      throw new Error('小红书 Cookie 未配置，无法搜索');
    }

    // 频率限制检查（滑动窗口）
    await this.checkRateLimit();
    
    // 搜索间延迟（模拟人工操作）
    await this.requestDelay();
    
    try {
      const results = await this.searchViaPython(keyword, maxResults);
      logger.info(`小红书搜索完成，返回 ${results.length} 条结果`);
      
      if (results.length === 0) {
        throw new Error('小红书搜索结果为空');
      }
      
      // 对前 2 条有 xsecToken 的结果补充完整正文（搜索 API 只返回 desc 摘要）
      const enrichCount = Math.min(2, results.length);
      for (let i = 0; i < enrichCount; i++) {
        const result = results[i];
        if (!result.xsecToken || !result.url) continue;
        
        // 从 URL 提取 noteId
        const noteIdMatch = result.url.match(/explore\/([a-f0-9]+)/);
        if (!noteIdMatch) continue;
        
        try {
          const detail = await this.getNoteDetail(noteIdMatch[1], result.xsecToken);
          if (detail.success && detail.data) {
            // 用完整正文替换简短描述
            if (detail.data.content && detail.data.content.length > (result.content?.length || 0)) {
              results[i] = {
                ...result,
                content: detail.data.content,
                imageUrls: detail.data.images.length > 0 ? detail.data.images : result.imageUrls,
              };
              logger.info(`【正文增强】笔记 ${noteIdMatch[1]} 正文补充成功（${detail.data.content.length} 字）`);
            }
          }
          // 详情请求间随机延迟（避免风控）
          await this.requestDelay();
        } catch (err) {
          logger.debug(`笔记 ${noteIdMatch[1]} 正文补充失败，使用搜索摘要：${err instanceof Error ? err.message : String(err)}`);
          // 补充失败不影响整体结果
        }
      }
      
      return results;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      // 检测 Cookie 失效类错误，主动记录到数据库日志
      const cookieInvalidPatterns = ['权限', '登录', '没有权限', 'cookie', 'unauthorized', '403', '401'];
      const isCookieInvalid = cookieInvalidPatterns.some(p => errMsg.toLowerCase().includes(p.toLowerCase()));
      if (isCookieInvalid) {
        logger.warn(`小红书 Cookie 已失效：${errMsg}`);
        try {
          const storage = NetworkPostConfigStorage.getInstance();
          await storage.updateRefreshLog(0, 'failed', `Cookie 失效：${errMsg}`, 'xiaohongshu');
        } catch (logErr) {
          logger.error('写入 Cookie 失效日志失败:', logErr);
        }
      }
      throw error;
    }
  }

  /**
   * 确保 Cookie 已从数据库加载（带 5 分钟缓存）
   */
  private cookieLoadedAt: number = 0;
  private async ensureCookieLoaded(): Promise<void> {
    const now = Date.now();
    // 5 分钟缓存，避免频繁查数据库
    if (this.config.cookie && (now - this.cookieLoadedAt < 5 * 60 * 1000)) {
      return;
    }
    
    try {
      const storage = NetworkPostConfigStorage.getInstance();
      const status = await storage.getCookieStatus();
      
      if (status.hasCookie && status.cookie) {
        this.config.cookie = status.cookie;
        this.cookieLoadedAt = now;
        logger.debug('[XiaohongshuSearch] Cookie 从数据库加载成功');
      } else {
        logger.warn('[XiaohongshuSearch] 数据库中没有 Cookie');
      }
    } catch (error) {
      logger.error('[XiaohongshuSearch] 加载 Cookie 失败:', error);
    }
  }

  /**
   * 使用 Python xhshow 库
   */
  private async searchViaPython(keyword: string, maxResults: number): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // 记录参数信息
      logger.info(`Python 调用：keyword="${keyword}", maxResults=${maxResults}, cookie 长度=${this.config.cookie?.length || 0}`);
      
      const pythonScript = `
import json
import sys
import time
import random
import requests
from xhshow import Xhshow
import os

try:
    cookie = sys.argv[1]
    keyword = sys.argv[2]
    max_results = int(sys.argv[3])
    
    # 随机休眠 1-5 秒，模拟人工操作（不输出日志，避免误判为错误）
    sleep_time = random.uniform(1, 5)
    time.sleep(sleep_time)
    
    # Cookie 处理
    cookie = cookie.strip()
    cookie_dict = {}
    for item in cookie.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()
    
    a1_value = cookie_dict.get('a1')
    if not a1_value:
        print(json.dumps({"error": "无法从 Cookie 中提取 a1 值"}))
        sys.exit(1)
    
    # 初始化 xhshow 客户端
    client = Xhshow()
    search_id = client.get_search_request_id()
    
    # API 参数
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    uri = "/api/sns/web/v2/search/notes"
    
    actual_page_size = max(max_results, 10)
    
    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": actual_page_size,
        "search_id": search_id,
        "sort": "general",
        "note_type": 0,
        "extend": {"title_encoding": 1, "desc_encoding": 1}
    }
    
    # 使用 sign_headers 生成完整请求头（避免被识别为自动化请求）
    headers = client.sign_headers(
        method="POST",
        uri=uri,
        cookies=cookie_dict,
        payload=payload,
        x_rap=False
    )
    headers["Content-Type"] = "application/json"
    headers["Origin"] = "https://www.xiaohongshu.com"
    headers["Referer"] = "https://www.xiaohongshu.com/explore"
    
    # 发送请求
    response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
    
    if response.status_code != 200:
        print(json.dumps({"error": f"HTTP {response.status_code}"}))
        sys.exit(1)
    
    result = response.json()
    
    if not result.get('success'):
        print(json.dumps({"error": result.get('msg', '请求失败')}))
        sys.exit(1)
    
    items = result.get('data', {}).get('items', [])
    notes = []
    
    for item in items:
        try:
            note_data = item.get('note_card', {}) or item.get('model', {})
            note_id = item.get('id', '')
            xsec_token = item.get('xsec_token', '')
            
            note = {
                'id': note_id,
                'title': note_data.get('display_title', '') or note_data.get('title', '') or '',
                'desc': note_data.get('desc', '') or '',
                'user': {
                    'nickname': note_data.get('user', {}).get('nickname', '') or '',
                    'avatar': note_data.get('user', {}).get('avatar', '') or '',
                    'user_id': note_data.get('user', {}).get('user_id', '') or ''
                },
                'interact_info': {
                    'liked_count': str(note_data.get('interact_info', {}).get('liked_count', 0)),
                    'collected_count': str(note_data.get('interact_info', {}).get('collected_count', 0)),
                    'comment_count': str(note_data.get('interact_info', {}).get('comment_count', 0))
                },
                'cover': {
                    'url': note_data.get('cover', {}).get('url', '') or ''
                },
                'xsec_token': xsec_token,
                'type': note_data.get('type', 'normal'),
                'url': f"https://www.xiaohongshu.com/explore/{note_id}" if note_id else ''
            }
            notes.append(note)
        except Exception as e:
            continue
    
    # 只输出 JSON 到 stdout，不输出其他信息（避免被误判为错误）
    print(json.dumps({"success": True, "notes": notes, "total": len(notes)}))
    
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
    sys.exit(1)
`;

      // 使用 Python 3 (Docker 环境中为 python3，本地开发可设置 PYTHON_EXECUTABLE 环境变量)
      const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';
      const pyProcess = spawn(pythonExecutable, [
        '-c', 
        pythonScript, 
        this.config.cookie, 
        keyword, 
        maxResults.toString()
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let settled = false;
      let output = '';
      let errorOutput = '';

      pyProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      pyProcess.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
        logger.warn('Python stderr:', data.toString());
      });

      pyProcess.on('error', (err) => {
        if (settled) return;
        settled = true;
        logger.error('Python 进程启动失败:', err);
        reject(err);
      });

      pyProcess.on('close', (code: number, signal: string | null) => {
        if (settled) return;
        settled = true;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(`Python 进程结束 - 退出码：${code}, 信号：${signal}, stdout 长度：${output.length}, stderr 长度：${errorOutput.length}`);
        logger.debug('Python 输出:', output);
        logger.debug('Python 错误输出:', errorOutput);
        
        if (code !== 0) {
          // 记录详细错误信息
          if (errorOutput.trim()) {
            logger.error('Python 错误详情:', errorOutput);
          } else {
            logger.error(`Python 进程异常退出 - 退出码：${code}, 信号：${signal}, stdout: ${output.substring(0, 200)}`);
          }
          // 尝试从 stdout 解析错误 JSON（Python 脚本可能输出 {"error": "..."} 后 sys.exit(1)）
          let errorMsg = errorOutput || `Python 进程退出码：${code}`;
          if (output.trim()) {
            try {
              const errResult = JSON.parse(output);
              if (errResult.error) {
                errorMsg = errResult.error;
              }
            } catch (e) {
              // stdout 不是 JSON，保持原错误信息
              if (!errorOutput.trim()) {
                errorMsg = output.trim() || errorMsg;
              }
            }
          }
          reject(new Error(errorMsg));
          return;
        }

        try {
          const result = JSON.parse(output);
          logger.debug('解析结果:', JSON.stringify(result, null, 2).substring(0, 500));
          
          if (result.error) {
            reject(new Error(result.error));
            return;
          }

          const notes: XiaohongshuNote[] = result.notes || [];
          const noteCount = notes.length;
          
          logger.info(`小红书 API 调用成功：${noteCount} 条结果，耗时 ${elapsed}秒`);
          
          const searchResults: SearchResult[] = notes.map(note => ({
            title: note.title || '无标题',
            content: note.desc || '',
            source: '小红书',
            url: note.url || `https://www.xiaohongshu.com/explore/${note.id}`,
            author: note.user?.nickname || '未知用户',
            likes: parseInt(note.interact_info?.liked_count) || 0,
            comments: parseInt(note.interact_info?.comment_count) || 0,
            collects: parseInt(note.interact_info?.collected_count) || 0,
            coverImage: note.cover?.url || undefined,
            publishTime: undefined,
            xsecToken: note.xsec_token || undefined,
          }));

          resolve(searchResults);
        } catch (e) {
          reject(new Error(`解析响应失败：${output}`));
        }
      });

      // 设置超时
      setTimeout(() => {
        if (settled) return;
        settled = true;
        pyProcess.kill();
        reject(new Error('搜索超时（30 秒）'));
      }, 30000);
    });
  }

  /**
   * 获取小红书笔记详情（使用详情 API）
   * @param noteId 笔记 ID
   * @param xsecToken 可选的 xsec_token（用于访问受限笔记）
   * @returns 笔记详情
   */
  async getNoteDetail(noteId: string, xsecToken?: string): Promise<{
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
      logger.info(`开始获取笔记详情：${noteId}`);
      
      // 使用重试机制调用 API
      const result = await this.retryWithBackoff(
        () => this.getDetailViaAPI(noteId, xsecToken),
        '详情 API 调用'
      );
      
      if (result.success && result.data) {
        logger.info(`笔记详情获取成功：${result.data.title}`);
        return {
          success: true,
          data: {
            id: result.data.id,
            title: result.data.title || '无标题',
            content: result.data.desc || '',
            author: result.data.user?.nickname || '未知用户',
            likes: parseInt(result.data.interact_info?.liked_count) || 0,
            collects: parseInt(result.data.interact_info?.collected_count) || 0,
            comments: parseInt(result.data.interact_info?.comment_count) || 0,
            images: result.data.images || [],
            url: result.data.url || `https://www.xiaohongshu.com/explore/${noteId}`,
          },
        };
      } else {
        return {
          success: false,
          error: result.error || '获取详情失败',
        };
      }
    } catch (error) {
      logger.error('获取笔记详情失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取详情失败',
      };
    }
  }

  /**
   * 使用详情 API 获取笔记详情
   */
  private async getDetailViaAPI(noteId: string, xsecToken?: string): Promise<{
    success: boolean;
    data?: {
      id: string;
      title: string;
      desc: string;
      user: { nickname: string };
      interact_info: {
        liked_count: string;
        collected_count: string;
        comment_count: string;
      };
      images: string[];
      url: string;
    };
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      const pythonScript = `
import json
import sys
import time
import random
import requests
from xhshow import Xhshow

def get_note_detail_api(note_id, xsec_token, cookie):
    """使用详情 API 获取笔记内容"""
    try:
        # Cookie 处理
        cookie = cookie.strip()
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        a1_value = cookie_dict.get('a1')
        if not a1_value:
            return {"success": False, "error": "无法从 Cookie 中提取 a1 值"}
        
        # 初始化客户端
        client = Xhshow()
        
        # 如果没有提供 xsec_token，尝试从搜索获取
        if not xsec_token:
            return {"success": False, "error": "缺少 xsec_token 参数"}
        
        # 详情 API 参数
        url = "https://edith.xiaohongshu.com/api/sns/web/v1/feed"
        uri = "/api/sns/web/v1/feed"
        
        payload = {
            "source_note_id": note_id,
            "image_formats": ["jpg", "webp", "avif"],
            "extra": {"need_body_topic": "1"},
            "xsec_source": "pc_search",
            "xsec_token": xsec_token
        }
        
        # 生成签名
        headers = client.sign_headers(
            method="POST",
            uri=uri,
            cookies=cookie_dict,
            payload=payload,
            x_rap=True
        )
        
        # 发送请求
        response = requests.post(
            url,
            headers=headers,
            cookies=cookie_dict,
            json=payload,
            timeout=30
        )
        
        if response.status_code != 200:
            return {"success": False, "error": f"HTTP {response.status_code}"}
        
        result = response.json()
        
        if not result.get('success'):
            error_msg = result.get('msg', '请求失败')
            if '笔记暂时无法浏览' in error_msg or '已删除' in error_msg:
                return {"success": False, "error": error_msg}
            return {"success": False, "error": error_msg}
        
        items = result.get('data', {}).get('items', [])
        if not items:
            return {"success": False, "error": "未找到笔记数据"}
        
        item = items[0]
        note_card = item.get('note_card', {})
        user = note_card.get('user', {})
        interact = note_card.get('interact_info', {})
        
        # 提取图片
        images = []
        image_list = note_card.get('image_list', [])
        for img in image_list:
            img_url = img.get('url', '') or img.get('url_default', '')
            if img_url:
                images.append(img_url)
        
        # 如果没有 image_list，尝试从 track_info 获取
        if not images:
            track_info = note_card.get('track_info', {})
            if isinstance(track_info, dict):
                img_url = track_info.get('cover_image_url', '')
                if img_url:
                    images.append(img_url)
        
        return {
            "success": True,
            "data": {
                "id": note_id,
                "title": note_card.get('title', '') or note_card.get('display_title', ''),
                "desc": note_card.get('desc', ''),
                "user": {"nickname": user.get('nickname', '')},
                "interact_info": {
                    "liked_count": str(interact.get('liked_count', 0)),
                    "collected_count": str(interact.get('collected_count', 0)),
                    "comment_count": str(interact.get('comment_count', 0))
                },
                "images": images,
                "url": f"https://www.xiaohongshu.com/explore/{note_id}"
            }
        }
        
    except Exception as e:
        import traceback
        return {"success": False, "error": f"{str(e)}: {traceback.format_exc()}"}

# 主逻辑
cookie = sys.argv[1]
note_id = sys.argv[2]
xsec_token = sys.argv[3] if len(sys.argv) > 3 else ''

# 随机延迟 1-3 秒
time.sleep(random.uniform(1, 3))

result = get_note_detail_api(note_id, xsec_token, cookie)
print(json.dumps(result, ensure_ascii=False))
`;

      const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';
      const args = [
        '-c',
        pythonScript,
        this.config.cookie,
        noteId,
        xsecToken || '',
      ];

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
      const results = await this.search(['测试'], 5);
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
}
