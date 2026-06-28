/**
 * API Token 配置管理模块
 * 
 * 提供独立的 API Token 生成、存储、读取和验证功能，
 * 用于远程发帖 API 的鉴权，与登录 Token 分离。
 * 使用 Redis 存储，无文件降级方案。
 */

import * as crypto from 'crypto';
import { getLogger } from './logger';
import { apiTokenStorage } from '../storage/redis/api-token-storage';

const logger = getLogger('api-token');

/**
 * API Token 配置接口
 */
export interface ApiTokenConfig {
  token: string;           // API Token（格式：api_token_<64 字符 hex>）
  createdAt: string;       // 创建时间（ISO 8601 格式）
  lastUsedAt?: string;     // 最后使用时间（可选）
}

/**
 * Token 状态信息（不暴露完整 Token）
 */
export interface TokenStatus {
  configured: boolean;     // 是否已配置
  createdAt?: string;      // 创建时间
  lastUsedAt?: string;     // 最后使用时间
  tokenPrefix?: string;    // Token 前缀（用于识别，如 "api_token_abc123..."）
}

/**
 * 生成新的 API Token
 * 
 * 使用加密安全的随机数生成器生成 32 字节（256 位）的随机数，
 * 转换为 hex 编码（64 字符），并添加前缀 "api_token_"
 * 
 * @returns 生成的 API Token
 */
export function generateApiToken(): string {
  const randomBytes = crypto.randomBytes(32);
  const hexString = randomBytes.toString('hex');
  return `api_token_${hexString}`;
}

/**
 * 保存 API Token 到 Redis（异步）
 * 
 * @param token API Token
 * @returns 保存的 Token 配置对象
 */
export async function saveApiTokenAsync(token: string): Promise<ApiTokenConfig> {
  const config: ApiTokenConfig = {
    token,
    createdAt: new Date().toISOString(),
  };
  
  // 保存到 Redis
  await apiTokenStorage.saveToken(token);
  
  // 刷新内存缓存，确保验证时使用最新 Token
  refreshCachedToken(token);
  
  logger.info('API Token 已保存到 Redis');
  return config;
}

/**
 * 从 Redis 读取 API Token（异步）
 * 
 * @returns Token 配置对象，如果不存在则返回 null
 */
export async function readApiTokenAsync(): Promise<ApiTokenConfig | null> {
  try {
    const token = await apiTokenStorage.getToken();
    
    if (!token) {
      logger.debug('Redis 中未找到 API Token');
      return null;
    }
    
    return {
      token,
      createdAt: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error(`从 Redis 读取 API Token 失败：${error.message}`);
    return null;
  }
}

/**
 * 验证提供的 Token 是否匹配（从 Redis 读取）
 * 
 * @param providedToken 用户提供的 Token
 * @returns 验证是否成功
 */
export async function verifyApiTokenAsync(providedToken: string): Promise<boolean> {
  try {
    const storedToken = await apiTokenStorage.getToken();
    
    if (!storedToken) {
      logger.warn('Token 验证失败：Redis 中未找到 Token');
      return false;
    }
    
    // 使用常量时间比较防止时序攻击
    if (providedToken.length !== storedToken.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < providedToken.length; i++) {
      result |= providedToken.charCodeAt(i) ^ storedToken.charCodeAt(i);
    }
    
    const isValid = result === 0;
    
    if (isValid) {
      logger.debug('API Token 验证成功（Redis）');
    } else {
      logger.warn('API Token 验证失败：Token 不匹配（Redis）');
    }
    
    return isValid;
  } catch (error: any) {
    logger.error(`Redis Token 验证异常：${error.message}`);
    return false;
  }
}

/**
 * 获取 Token 状态信息（不暴露完整 Token）
 * 
 * @returns Token 状态对象
 */
export async function getTokenStatus(): Promise<TokenStatus> {
  const config = await readApiTokenAsync();
  
  if (!config) {
    return {
      configured: false,
    };
  }
  
  // 提取 Token 前缀用于识别（前 20 个字符）
  const tokenPrefix = config.token.substring(0, 20) + '...';
  
  return {
    configured: true,
    createdAt: config.createdAt,
    tokenPrefix,
  };
}

/**
 * 重置 API Token
 * 
 * 生成新的 Token 并覆盖旧 Token
 * 
 * @returns 新的 Token 配置对象
 */
export async function resetApiToken(): Promise<ApiTokenConfig> {
  logger.info('重置 API Token...');
  
  const newToken = generateApiToken();
  return await saveApiTokenAsync(newToken);
}

/**
 * 初始化 API Token（如果不存在则创建）
 * 
 * @returns Token 配置对象
 */
export async function initApiToken(): Promise<ApiTokenConfig> {
  const config = await readApiTokenAsync();
  
  if (config) {
    logger.info('API Token 已存在');
    return config;
  }
  
  logger.info('初始化 API Token...');
  const newToken = generateApiToken();
  return await saveApiTokenAsync(newToken);
}

/**
 * 验证提供的 Token 是否匹配（同步版本，使用内存缓存）
 * 注意：此函数首次调用时会异步加载 Token，之后使用缓存
 * 
 * @param providedToken 用户提供的 Token
 * @returns 验证是否成功
 */
let cachedToken: string | null = null;
let tokenLoaded = false;

/**
 * 刷新内存缓存中的 Token
 * 当保存新 Token 时调用此函数，确保验证时使用最新 Token
 * 
 * @param newToken 新的 Token
 */
export function refreshCachedToken(newToken: string): void {
  cachedToken = newToken;
  tokenLoaded = true;
  logger.debug('API Token 缓存已刷新');
}

export async function verifyApiToken(providedToken: string): Promise<boolean> {
  // 如果还未加载缓存，先加载
  if (!tokenLoaded) {
    const config = await readApiTokenAsync();
    cachedToken = config?.token || null;
    tokenLoaded = true;
  }
  
  if (!cachedToken) {
    logger.warn('Token 验证失败：未找到 Token');
    return false;
  }
  
  // 使用常量时间比较防止时序攻击
  if (providedToken.length !== cachedToken.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < providedToken.length; i++) {
    result |= providedToken.charCodeAt(i) ^ cachedToken.charCodeAt(i);
  }
  
  const isValid = result === 0;
  
  if (isValid) {
    logger.debug('API Token 验证成功');
  } else {
    logger.warn('API Token 验证失败：Token 不匹配');
  }
  
  return isValid;
}
