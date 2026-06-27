import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { IAudiApi } from '../api/types';
import { apiTokenStorage } from '../storage/redis/api-token-storage';

const logger = getLogger('auth');

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  savedAt: number;
}

/**
 * AuthService
 * 
 * 负责管理用户登录和 Token
 * 使用 Redis 存储 Token（通过 apiTokenStorage）
 * Redis 不可用时降级到内存存储
 */
export class AuthService {
  private token: TokenData | null = null;
  private api: IAudiApi;

  private constructor(api: IAudiApi) {
    this.api = api;
  }

  /**
   * 静态工厂方法：创建并初始化 AuthService
   * 确保所有异步初始化完成后再返回实例
   */
  static async create(api: IAudiApi): Promise<AuthService> {
    const instance = new AuthService(api);
    await instance.loadStoredToken();
    instance.setupTokenRenewal();
    return instance;
  }

  /**
   * 获取有效的 access_token，如果过期则自动刷新
   * 每次调用时都从 Redis 读取最新的 Token
   */
  async getAccessToken(): Promise<string> {
    // 每次都从 Redis 读取最新的 Token
    const redisToken = await apiTokenStorage.getToken();
    if (redisToken && this.token?.accessToken !== redisToken) {
      // Redis 中的 Token 与内存中不同，更新内存
      logger.info('检测到 Redis 中 Token 已更新，同步到内存');
      this.token = {
        accessToken: redisToken,
        refreshToken: '',
        expiresAt: Date.now() + 83 * 3600 * 1000,
        savedAt: Date.now(),
      };
    }

    if (this.token && this.isTokenValid()) {
      this.checkTokenAgeWarning();
      return this.token.accessToken;
    }

    // 尝试使用 refresh_token 刷新（Mock 模式）
    if (this.token?.refreshToken) {
      try {
        logger.info('Token 过期，尝试刷新...');
        const response = await this.api.refreshToken(this.token.refreshToken);
        this.saveToken(response);
        return this.token.accessToken;
      } catch (error) {
        logger.warn('刷新 token 失败，尝试重新登录');
      }
    }

    // 检查是否有预存的 Token（真实模式下通过 Web UI 登录获取）
    if (this.token?.accessToken) {
      logger.warn('Token 已过期，请通过 Web 管理界面重新登录获取新 Token');
      throw new Error('Token 已过期，请通过 Web UI 重新登录');
    }

    // 重新登录（仅 Mock 模式可自动登录）
    return this.login();
  }

  /**
   * 执行登录并保存 token
   */
  async login(): Promise<string> {
    const config = loadConfig();
    logger.info('执行登录...');
    const response = await this.api.login(config.auth.username, config.auth.password);
    this.saveToken(response);
    logger.info('登录成功');
    return this.token!.accessToken;
  }

  /**
   * 通过 Web UI 登录保存 Token（供 auth-routes 调用）
   */
  saveLoginToken(accessToken: string, expiresIn: number = 300000): void {
    this.token = {
      accessToken,
      refreshToken: '',
      expiresAt: Date.now() + expiresIn * 1000,
      savedAt: Date.now(),
    };
    // 保存到 Redis（自动降级到内存）
    this.persistTokenToRedis();
    logger.info('Web UI 登录成功，Token 已保存到 Redis');
  }

  /**
   * 响应头 Token 续期回调（供 RealAudiApi 调用）
   */
  updateTokenFromResponse(newToken: string): void {
    if (this.token) {
      this.token.accessToken = newToken;
      this.token.expiresAt = Date.now() + 300000 * 1000; // 重置 83h
      this.token.savedAt = Date.now();
      this.persistTokenToRedis();
      logger.info('Token 已通过响应头续期');
    }
  }

  /**
   * 检查当前 token 是否有效
   */
  isTokenValid(): boolean {
    if (!this.token) return false;
    // 提前 5 分钟视为过期
    return Date.now() < this.token.expiresAt - 5 * 60 * 1000;
  }

  /**
   * 获取当前 Token 状态信息（供 Web UI 展示）
   *
   * - 无 token 时：{ valid: false } (省略 expiresAt 和 remainingHours)
   * - token 存在且有效 (remaining > 5min): { valid: true, expiresAt, remainingHours }
   * - token 存在但过期 (remaining ≤ 5min): { valid: false, expiresAt, remainingHours: 0 }
   */
  getTokenStatus(): { valid: boolean; expiresAt?: number; remainingHours?: number } {
    if (!this.token) return { valid: false };
    return computeTokenStatus(Date.now(), this.token.expiresAt);
  }

  private setupTokenRenewal(): void {
    // 如果是 RealAudiApi，注入续期回调
    if (this.api && 'setTokenRenewalCallback' in this.api) {
      (this.api as any).setTokenRenewalCallback((newToken: string) => {
        this.updateTokenFromResponse(newToken);
      });
    }
  }

  private checkTokenAgeWarning(): void {
    if (!this.token?.savedAt) return;
    const ageHours = (Date.now() - this.token.savedAt) / (3600 * 1000);
    if (ageHours > 70) {
      logger.warn(`Token 已存储 ${Math.round(ageHours)} 小时，接近过期（83h），建议通过 Web UI 重新登录`);
    }
  }

  private saveToken(response: any): void {
    this.token = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      savedAt: Date.now(),
    };
    this.persistTokenToRedis();
  }

  /**
   * 持久化 Token 到 Redis（使用 apiTokenStorage，支持降级）
   */
  private async persistTokenToRedis(): Promise<void> {
    if (!this.token) return;
    try {
      await apiTokenStorage.saveToken(this.token.accessToken);
      logger.debug('Token 已保存到 Redis');
    } catch (error) {
      logger.warn('保存到 Redis 失败，已降级到内存存储:', error);
    }
  }

  /**
   * 从 Redis 加载 Token
   * 注意：从 Redis 加载时无法知道 Token 的实际过期时间，只能设置一个较长的默认值
   * 实际的 Token 有效性通过远端验证确认
   */
  private async loadStoredToken(): Promise<void> {
    try {
      const redisToken = await apiTokenStorage.getToken();
      if (redisToken) {
        logger.info('已从 Redis 加载 Token');
        // 从 Redis 加载时，我们只有 accessToken，需要构造一个 TokenData
        // 设置一个较长的默认过期时间（83 小时），实际有效性通过远端验证确认
        this.token = {
          accessToken: redisToken,
          refreshToken: '',
          expiresAt: Date.now() + 83 * 3600 * 1000,
          savedAt: Date.now(),
        };
        return;
      }
    } catch (error) {
      logger.warn('从 Redis 加载 Token 失败，使用内存存储:', error);
    }
    
    // Redis 没有 Token，使用内存存储（需要重新登录）
    logger.info('Redis 中无 Token，需要重新登录');
    this.token = null;
  }
}

/**
 * 纯函数：计算 Token 状态（可独立测试）
 *
 * Token validity: currentTime < expiresAt - 300000 (5 minutes buffer)
 * remainingHours: max(0, round((expiresAt - currentTime) / 3600000, 1))
 * 当 token 无效（remaining ≤ 5min）时 remainingHours 为 0
 */
export function computeTokenStatus(currentTime: number, expiresAt: number): {
  valid: boolean;
  expiresAt: number;
  remainingHours: number;
} {
  const valid = currentTime < expiresAt - 300000;
  const remainingHours = valid
    ? Math.max(0, Math.round(((expiresAt - currentTime) / 3600000) * 10) / 10)
    : 0;
  return { valid, expiresAt, remainingHours };
}
