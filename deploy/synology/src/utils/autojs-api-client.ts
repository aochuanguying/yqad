/**
 * AutoJS API 客户端模块
 * 
 * 用于调用 AutoJS API Service 远程执行脚本
 * 文档参考：docs/API 文档.md
 */

import axios from 'axios';
import { getLogger } from './logger';

const logger = getLogger('autojs-api');

/**
 * AutoJS API 配置
 */
export interface AutoJsApiConfig {
  baseUrl: string;      // AutoJS API 服务器地址，如 http://192.168.50.149:8899
  apiToken: string;     // API Token
}

/**
 * AutoJS API 执行脚本请求体
 */
export interface ExecuteScriptRequest {
  script: string;       // 脚本文件名（如 "audi_post.js"）
  sync?: boolean;       // 是否同步等待执行完成（默认：false）
}

/**
 * AutoJS API 执行脚本响应
 */
export interface ExecuteScriptResponse {
  success: boolean;
  message?: string;
  data?: {
    script: string;
    sync: boolean;
  };
}

/**
 * AutoJS API 获取脚本列表响应
 */
export interface GetScriptsResponse {
  success: boolean;
  message?: string;
  data?: {
    scripts: string[];
  };
}

/**
 * AutoJS API 客户端类
 */
export class AutoJsApiClient {
  private baseUrl: string;
  private apiToken: string;
  private axiosInstance: any;

  constructor(config: AutoJsApiConfig) {
    this.baseUrl = config.baseUrl;
    this.apiToken = config.apiToken;

    // 创建 axios 实例
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 秒超时
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 添加请求拦截器，自动添加认证头
    this.axiosInstance.interceptors.request.use(
      (config: any) => {
        config.headers.Authorization = `Bearer ${this.apiToken}`;
        return config;
      },
      (error: any) => {
        logger.error(`请求拦截器异常：${error.message}`);
        return Promise.reject(error);
      }
    );

    logger.info(`AutoJS API 客户端已初始化：${this.baseUrl}`);
  }

  /**
   * 执行远程脚本
   * @param script 脚本文件名
   * @param sync 是否同步等待
   * @returns 执行结果
   */
  async executeScript(script: string, sync: boolean = false): Promise<ExecuteScriptResponse> {
    try {
      logger.info(`执行远程脚本：${script} (sync: ${sync})`);

      const request: ExecuteScriptRequest = {
        script,
        sync,
      };

      const response = await this.axiosInstance.post('/api/execute', request);
      const result = response.data as ExecuteScriptResponse;

      if (result.success) {
        logger.info(`远程脚本执行成功：${script}`);
      } else {
        logger.warn(`远程脚本执行失败：${result.message}`);
      }

      return result;
    } catch (error: any) {
      logger.error(`调用 AutoJS API 失败：${error.message}`);
      
      // 构建错误响应
      const errorResponse: ExecuteScriptResponse = {
        success: false,
        message: error.response?.data?.message || error.message,
      };
      
      return errorResponse;
    }
  }

  /**
   * 获取脚本列表
   * @returns 脚本列表
   */
  async getScripts(): Promise<GetScriptsResponse> {
    try {
      logger.info('获取 AutoJS 脚本列表');
      
      const response = await this.axiosInstance.get('/api/scripts');
      const result = response.data as GetScriptsResponse;
      
      if (result.success) {
        logger.info(`获取到 ${result.data?.scripts.length || 0} 个脚本`);
      } else {
        logger.warn(`获取脚本列表失败：${result.message}`);
      }
      
      return result;
    } catch (error: any) {
      logger.error(`调用 AutoJS API 获取脚本列表失败：${error.message}`);
      
      const errorResponse: GetScriptsResponse = {
        success: false,
        message: error.response?.data?.message || error.message,
      };
      
      return errorResponse;
    }
  }

  /**
   * 健康检查
   * @returns 服务状态
   */
  async healthCheck(): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await this.axiosInstance.get('/api/health');
      return response.data;
    } catch (error: any) {
      logger.error(`健康检查失败：${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

/**
 * 创建 AutoJS API 客户端实例
 * @param config 配置对象
 * @returns AutoJS API 客户端
 */
export function createAutoJsApiClient(config: AutoJsApiConfig): AutoJsApiClient {
  return new AutoJsApiClient(config);
}
