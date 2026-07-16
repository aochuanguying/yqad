/**
 * Bark 推送客户端
 * 
 * 提供 Bark 推送通知功能，用于车辆监控异常报警
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { getLogger } from '../utils/logger';

const logger = getLogger('bark-client');

// ===================== 类型定义 =====================

export interface BarkConfig {
  barkKey: string;
  barkServer?: string;
}

export interface SendPushResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ===================== 常量 =====================

const API_TIMEOUT_MS = 10000; // 10 秒超时
const DEFAULT_BARK_SERVER = 'https://api.day.app';
const PUSH_ENDPOINT = '/push';
const HEALTH_CHECK_ENDPOINT = '/health';

// ===================== 客户端类 =====================

class BarkClient {
  private axiosInstance: AxiosInstance | null = null;
  private config: BarkConfig | null = null;

  /**
   * 初始化 Bark 客户端
   */
  init(config: BarkConfig): void {
    this.config = config;
    
    if (!config.barkKey) {
      logger.warn('Bark 客户端初始化失败：Bark 键为空');
      this.axiosInstance = null;
      return;
    }
    
    const serverUrl = config.barkServer || DEFAULT_BARK_SERVER;
    
    this.axiosInstance = axios.create({
      baseURL: serverUrl,
      timeout: API_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    logger.info('Bark 客户端已初始化', { server: serverUrl, key: this.maskKey(config.barkKey) });
  }

  /**
   * 验证配置是否有效
   */
  isConfigured(): boolean {
    return !!(this.config && this.config.barkKey);
  }

  /**
   * 获取当前配置（用于测试）
   */
  getConfig(): BarkConfig | null {
    return this.config;
  }

  /**
   * 发送 Bark 推送
   * @param title 推送标题
   * @param body 推送正文
   * @param options 可选参数（category, group, url 等）
   */
  async sendPush(title: string, body: string, options?: {
    category?: string;
    group?: string;
    url?: string;
    icon?: string;
    level?: 'active' | 'timeSensitive';
    sound?: string;
  }): Promise<SendPushResult> {
    if (!this.isConfigured() || !this.axiosInstance) {
      const error = 'Bark 未配置';
      logger.error(error);
      return { success: false, error };
    }

    try {
      logger.info('发送 Bark 推送', { title, bodyLength: body.length });
      
      const payload: any = {
        title: title,
        body: body,
      };
      
      // 添加可选参数
      if (options) {
        if (options.category) payload.category = options.category;
        if (options.group) payload.group = options.group;
        if (options.url) payload.url = options.url;
        if (options.icon) payload.icon = options.icon;
        if (options.level) payload.level = options.level;
        if (options.sound) payload.sound = options.sound;
      }
      
      const response = await this.axiosInstance.post(PUSH_ENDPOINT, payload);
      const data = response.data;
      
      if (data.code === 200 || data.success === true) {
        logger.info('Bark 推送发送成功', { title });
        return { success: true, message: data.message || '推送发送成功' };
      } else {
        const errorMsg = data.message || 'Bark 推送发送失败';
        logger.error('Bark 推送发送失败', { error: errorMsg });
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = this.handleAxiosError(error, '发送 Bark 推��');
      logger.error('Bark 推送发送异常', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 测试 API 连接
   * @param barkServer Bark 服务器地址
   * @param barkKey Bark 键
   */
  async testConnection(barkServer: string, barkKey: string): Promise<TestConnectionResult> {
    try {
      logger.info('测试 Bark API 连接', { server: barkServer });
      
      const testAxios = axios.create({
        baseURL: barkServer,
        timeout: API_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // 尝试发送一条测试消息
      const response = await testAxios.post(PUSH_ENDPOINT, {
        title: '测试连接',
        body: 'Bark API 连接测试',
      });
      
      const data = response.data;
      
      if (data.code === 200 || data.success === true) {
        logger.info('Bark API 连接测试成功');
        return { success: true, message: 'API 连接正常' };
      } else {
        const errorMsg = 'API 响应异常';
        logger.error('Bark API 连接测试失败', { error: errorMsg });
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = this.handleAxiosError(error, '测试连接');
      logger.error('Bark API 连接测试异常', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 处理 Axios 错误
   */
  private handleAxiosError(error: unknown, operation: string): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
        return `${operation}超时（${API_TIMEOUT_MS / 1000}秒）`;
      }
      
      if (axiosError.response) {
        // API 返回错误状态
        const status = axiosError.response.status;
        const data = axiosError.response.data as any;
        return `${operation}失败：HTTP ${status} - ${data?.message || data?.error || '未知错误'}`;
      }
      
      if (axiosError.request) {
        // 请求已发出但未收到响应
        return `${operation}失败：无法连接到 API 服务`;
      }
      
      // 其他错误
      return `${operation}失败：${axiosError.message}`;
    }
    
    // 非 Axios 错误
    return `${operation}异常：${error instanceof Error ? error.message : String(error)}`;
  }

  /**
   * 掩码 Bark 键（显示前 8 位）
   */
  private maskKey(key: string): string {
    if (!key || key.length <= 8) {
      return '***';
    }
    return key.substring(0, 8) + '***';
  }
}

// ===================== 单例导出 =====================

export const barkClient = new BarkClient();
export default barkClient;
