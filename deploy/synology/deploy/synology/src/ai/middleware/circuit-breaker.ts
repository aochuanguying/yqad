/**
 * 熔断器
 */

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenMaxRequests?: number;
}

export interface CircuitBreakerStatus {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  nextResetTime?: number;
}

export class CircuitBreaker {
  private failureThreshold: number;
  private resetTimeout: number;
  private halfOpenMaxRequests: number;
  
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private halfOpenRequests: number = 0;

  constructor(config?: CircuitBreakerConfig) {
    this.failureThreshold = config?.failureThreshold ?? 5;
    this.resetTimeout = config?.resetTimeout ?? 60000;
    this.halfOpenMaxRequests = config?.halfOpenMaxRequests ?? 3;
  }

  canRequest(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenRequests = 0;
        return true;
      }
      return false;
    }

    // HALF_OPEN 状态
    return this.halfOpenRequests < this.halfOpenMaxRequests;
  }

  getStatus(): CircuitBreakerStatus {
    const status: CircuitBreakerStatus = {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };

    if (this.state === 'OPEN' && this.lastFailureTime) {
      status.nextResetTime = this.lastFailureTime + this.resetTimeout;
    }

    return status;
  }

  onSuccess(): void {
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.halfOpenRequests++;
      if (this.halfOpenRequests >= this.halfOpenMaxRequests) {
        this.reset();
      }
    }
  }

  onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenRequests = 0;
    this.lastFailureTime = undefined;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canRequest()) {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
