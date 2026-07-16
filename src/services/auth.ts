import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { IAudiApi } from '../api/types';
import { authTokenStorage } from '../storage/redis/auth-token-storage';

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
 * 使用 Redis 存储 Token（通过 authTokenStorage，键 auth:token）
 * Redis 不可用时降级到内存存储
 */
export class AuthService {
  private token: TokenData | null = null;
  private api: IAudiApi;
  private tokenRefreshTimer?: NodeJS.Timeout;
  private readonly TOKEN_REFRESH_INTERVAL = 12 * 60 * 60 * 1000; // 12 小时（毫秒）
  private readonly TOKEN_REFRESH_LEAD_TIME = 6 * 60 * 60 * 1000; // 提前 6 小时刷新（毫秒）

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
    instance.setupPeriodicTokenRefresh();
    return instance;
  }

  /**
   * 获取有效的 access_token，如果过期则自动刷新
   * 每次调用时都从 Redis 读取最新的 Token
   */
  async getAccessToken(): Promise<string> {
    // 每次都从 Redis 读取最新的 Token
    const redisToken = await authTokenStorage.getToken();
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

    // 检查是否有预存的 Token（通过 Web UI 登录获取）
    if (this.token?.accessToken) {
      logger.warn('Token 已过期，请通过 Web 管理界面重新登录获取新 Token');
      throw new Error('Token 已过期，请通过 Web UI 重新登录');
    }

    // 自动登录
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
      const oldTokenPrefix = this.token.accessToken.substring(0, 30) + '...';
      const newTokenPrefix = newToken.substring(0, 30) + '...';
      const oldExpiresAt = this.token.expiresAt;
      
      this.token.accessToken = newToken;
      this.token.expiresAt = Date.now() + 300000 * 1000; // 重置 83h
      this.token.savedAt = Date.now();
      this.persistTokenToRedis();
      
      // 计算续期效果
      const extendedHours = (this.token.expiresAt - oldExpiresAt) / 1000 / 3600;
      
      logger.info('========================================');
      logger.info('【Token 响应头自动续期】');
      logger.info(`  旧 Token: ${oldTokenPrefix}`);
      logger.info(`  新 Token: ${newTokenPrefix}`);
      logger.info(`  续期前过期时间：${new Date(oldExpiresAt).toLocaleString('zh-CN')}`);
      logger.info(`  续期后过期时间：${new Date(this.token.expiresAt).toLocaleString('zh-CN')}`);
      logger.info(`  延长小时数：${extendedHours.toFixed(1)} 小时`);
      logger.info('========================================');
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

  /**
   * 设置定期 Token 刷新机制
   * 每 12 小时检查一次，如果 Token 剩余时间不足 6 小时，则主动发起请求刷新
   */
  private setupPeriodicTokenRefresh(): void {
    // 清除旧的定时器（如果有）
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
    }

    // 设置定时器，每 12 小时检查一次
    this.tokenRefreshTimer = setInterval(() => {
      this.checkAndRefreshToken();
    }, this.TOKEN_REFRESH_INTERVAL);

    logger.info('========================================');
    logger.info('【Token 定期刷新机制已启动】');
    logger.info(`  检查间隔：${this.TOKEN_REFRESH_INTERVAL / 1000 / 3600} 小时`);
    logger.info(`  刷新阈值：${this.TOKEN_REFRESH_LEAD_TIME / 1000 / 3600} 小时（剩余时间低于此值时主动刷新）`);
    logger.info('========================================');
  }

  /**
   * 检查 Token 是否需要刷新，如需刷新则主动发起请求
   */
  private async checkAndRefreshToken(): Promise<void> {
    if (!this.token?.accessToken) {
      logger.debug('无 Token，跳过刷新');
      return;
    }

    const remainingTime = this.token.expiresAt - Date.now();
    const remainingHours = Math.round(remainingTime / 1000 / 3600);
    const expiresAtDate = new Date(this.token.expiresAt);
    const tokenPrefix = this.token.accessToken.substring(0, 20) + '...';

    logger.debug(`Token 刷新检查：剩余 ${remainingHours} 小时，过期时间：${expiresAtDate.toLocaleString('zh-CN')}`);

    // 如果剩余时间不足设定值，主动发起请求刷新
    if (remainingTime < this.TOKEN_REFRESH_LEAD_TIME) {
      logger.info('========================================');
      logger.info('【Token 主动刷新检查 - 触发刷新】');
      logger.info(`  当前 Token: ${tokenPrefix}`);
      logger.info(`  当前剩余时间：${remainingHours} 小时`);
      logger.info(`  过期时间：${expiresAtDate.toLocaleString('zh-CN')}`);
      logger.info(`  刷新阈值：${this.TOKEN_REFRESH_LEAD_TIME / 1000 / 3600} 小时`);
      logger.info(`  触发主动刷新：是`);
      logger.info('========================================');
      
      try {
        const beforeTime = Date.now();
        const beforeExpiresAt = this.token.expiresAt;
        
        // 调用会员信息接口触发 Token 续期
        if (this.api && 'getMemberInfo' in this.api) {
          logger.info('开始调用 getMemberInfo() 刷新 Token...');
          await (this.api as any).getMemberInfo(this.token.accessToken);
          const duration = Date.now() - beforeTime;
          const extendedHours = (this.token.expiresAt - beforeExpiresAt) / 1000 / 3600;
          
          logger.info('========================================');
          logger.info('【Token 主动刷新结果 - 成功】');
          logger.info(`  刷新接口：getMemberInfo`);
          logger.info(`  请求耗时：${duration}ms`);
          logger.info(`  刷新状态：✅ 成功`);
          logger.info(`  续期前过期时间：${new Date(beforeExpiresAt).toLocaleString('zh-CN')}`);
          logger.info(`  续期后过期时间：${new Date(this.token.expiresAt).toLocaleString('zh-CN')}`);
          logger.info(`  延长小时数：${extendedHours.toFixed(1)} 小时`);
          logger.info(`  ���新后 Token: ${tokenPrefix}`);
          logger.info('========================================');
        } else {
          logger.warn('API 未初始化或不支持 getMemberInfo，无法主动刷新 Token');
        }
      } catch (error: any) {
        logger.error('========================================');
        logger.error('【Token 主动刷新结果 - 失败】');
        logger.error(`  刷新接口：getMemberInfo`);
        logger.error(`  刷新状态：❌ 失败`);
        logger.error(`  错误类型：${error.constructor.name}`);
        logger.error(`  错误信息：${error.message}`);
        if (error.code) {
          logger.error(`  错误代码：${error.code}`);
        }
        logger.error('========================================');
        // 不抛出异常，避免影响主流程
      }
    } else {
      logger.debug(`Token 剩余时间充足（${remainingHours}小时），无需刷新`);
    }
  }

  /**
   * 停止定期 Token 刷新
   */
  public stopPeriodicTokenRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = undefined;
      logger.info('Token 定期刷新机制已停止');
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
   * 持久化 Token 到 Redis（使用 authTokenStorage，支持降级）
   */
  private async persistTokenToRedis(): Promise<void> {
    if (!this.token) return;
    try {
      await authTokenStorage.saveToken(this.token.accessToken);
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
      const redisToken = await authTokenStorage.getToken();
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
