/**
 * Android Telecom API 客户端
 * 
 * 提供短信发送和电话拨打功能，用于车辆监控异常报警
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { getLogger } from '../utils/logger';

const logger = getLogger('telecom-client');

// ===================== 类型定义 =====================

export interface TelecomConfig {
  apiUrl: string;
  apiToken: string;
  alertPhone: string;
}

export interface SendSmsResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface MakeCallResult {
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
const SMS_SEND_ENDPOINT = '/api/v1/sms/send';
const CALL_MAKE_ENDPOINT = '/api/v1/call';
const HEALTH_CHECK_ENDPOINT = '/health';

// ===================== 客户端类 =====================

class TelecomClient {
  private axiosInstance: AxiosInstance | null = null;
  private config: TelecomConfig | null = null;

  /**
   * 初始化 Telecom 客户端
   */
  init(config: TelecomConfig): void {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.apiUrl,
      timeout: API_TIMEOUT_MS,
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
    });
    logger.info('Telecom 客户端已初始化', { apiUrl: config.apiUrl });
  }

  /**
   * 验证配置是否有效
   */
  isConfigured(): boolean {
    return !!(this.config && this.config.apiUrl && this.config.apiToken);
  }

  /**
   * 获取当前配置（用于测试）
   */
  getConfig(): TelecomConfig | null {
    return this.config;
  }

  /**
   * 发送短信
   * @param phoneNumber 接收人手机号
   * @param message 短信内容
   */
  async sendSms(phoneNumber: string, message: string): Promise<SendSmsResult> {
    if (!this.isConfigured() || !this.axiosInstance) {
      const error = 'Telecom API 未配置';
      logger.error(error);
      return { success: false, error };
    }

    try {
      logger.info('发送短信', { phoneNumber, messageLength: message.length });
      
      const response = await this.axiosInstance.post(SMS_SEND_ENDPOINT, {
        phone_number: phoneNumber,
        message: message,
      });

      const data = response.data;
      if (data.success) {
        logger.info('短信发送成功', { phoneNumber });
        return { success: true, message: data.message || '短信发送成功' };
      } else {
        const errorMsg = data.message || '短信发送失败';
        logger.error('短信发送失败', { error: errorMsg });
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = this.handleAxiosError(error, '发送短信');
      logger.error('短信发送异常', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 拨打电话
   * @param phoneNumber 接收人手机号
   */
  async makePhoneCall(phoneNumber: string): Promise<MakeCallResult> {
    if (!this.isConfigured() || !this.axiosInstance) {
      const error = 'Telecom API 未配置';
      logger.error(error);
      return { success: false, error };
    }

    try {
      logger.info('拨打电话', { phoneNumber });
      
      const response = await this.axiosInstance.post(CALL_MAKE_ENDPOINT, {
        phone_number: phoneNumber,
      });

      const data = response.data;
      if (data.success) {
        logger.info('电话拨打成功', { phoneNumber });
        return { success: true, message: data.message || '电话拨打成功' };
      } else {
        const errorMsg = data.message || '电话拨打失败';
        logger.error('电话拨打失败', { error: errorMsg });
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = this.handleAxiosError(error, '拨打电话');
      logger.error('电话拨打异常', { error: errorMsg });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * 测试 API 连接
   * @param apiUrl API 地址
   * @param apiToken API Token
   */
  async testConnection(apiUrl: string, apiToken: string): Promise<TestConnectionResult> {
    try {
      logger.info('测试 Telecom API 连接', { apiUrl });
      
      const testAxios = axios.create({
        baseURL: apiUrl,
        timeout: API_TIMEOUT_MS,
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      const response = await testAxios.get(HEALTH_CHECK_ENDPOINT);
      const data = response.data;
      
      if (data.status === 'ok' || data.success === true) {
        logger.info('Telecom API 连接测试成功');
        return { success: true, message: 'API 连接正常' };
      } else {
        const errorMsg = 'API 响应异常';
        logger.error('Telecom API 连接测试失败', { error: errorMsg });
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = this.handleAxiosError(error, '测试连接');
      logger.error('Telecom API 连接测试异常', { error: errorMsg });
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
}

// ===================== 单例导出 =====================

export const telecomClient = new TelecomClient();
export default telecomClient;
