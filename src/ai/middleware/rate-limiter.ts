/**
 * 速率限制器
 */

export interface RateLimiterConfig {
  tokensPerMinute?: number;
  burstSize?: number;
  whitelist?: string[];
}

export interface RateLimitStatus {
  availableTokens: number;
  isWhitelisted: boolean;
  nextRefillTime: number;
}

export class RateLimiter {
  private tokensPerMinute: number;
  private burstSize: number;
  private whitelist: Set<string>;
  private tokens: Map<string, number> = new Map();
  private lastRefillTime: Map<string, number> = new Map();

  constructor(config?: RateLimiterConfig) {
    this.tokensPerMinute = config?.tokensPerMinute ?? 60;
    this.burstSize = config?.burstSize ?? 10;
    this.whitelist = new Set(config?.whitelist ?? []);
  }

  async acquire(providerName: string): Promise<boolean> {
    if (this.whitelist.has(providerName)) {
      return true;
    }

    this.refillTokens(providerName);
    
    const currentTokens = this.tokens.get(providerName) ?? this.burstSize;
    if (currentTokens >= 1) {
      this.tokens.set(providerName, currentTokens - 1);
      return true;
    }

    // 等待 token
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.acquire(providerName);
  }

  getStatus(providerName: string): RateLimitStatus {
    this.refillTokens(providerName);
    return {
      availableTokens: this.tokens.get(providerName) ?? this.burstSize,
      isWhitelisted: this.whitelist.has(providerName),
      nextRefillTime: (this.lastRefillTime.get(providerName) ?? 0) + 60000,
    };
  }

  private refillTokens(providerName: string): void {
    const now = Date.now();
    const lastRefill = this.lastRefillTime.get(providerName) ?? 0;
    
    if (now - lastRefill >= 60000) {
      this.tokens.set(providerName, this.burstSize);
      this.lastRefillTime.set(providerName, now);
    }
  }
}
