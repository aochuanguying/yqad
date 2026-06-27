/**
 * 速率限制器（已禁用 - 所有 provider 都不受速度限制）
 */

export interface RateLimiterConfig {
  tokensPerMinute?: number;
  burstSize?: number;
}

export interface RateLimitStatus {
  availableTokens: number;
  nextRefillTime: number;
}

export class RateLimiter {
  private tokensPerMinute: number;
  private burstSize: number;
  private tokens: Map<string, number> = new Map();
  private lastRefillTime: Map<string, number> = new Map();

  constructor(config?: RateLimiterConfig) {
    this.tokensPerMinute = config?.tokensPerMinute ?? 60;
    this.burstSize = config?.burstSize ?? 10;
  }

  async acquire(providerName: string): Promise<boolean> {
    // 已禁用速率限制，直接返回 true
    return true;
  }

  getStatus(providerName: string): RateLimitStatus {
    return {
      availableTokens: this.burstSize,
      nextRefillTime: 0,
    };
  }
}
