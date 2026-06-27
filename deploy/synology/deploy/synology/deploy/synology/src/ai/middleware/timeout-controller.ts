/**
 * 超时控制器
 */

export interface TimeoutOptions {
  timeout?: number;
}

export class TimeoutController {
  private timeout: number;

  constructor(options?: TimeoutOptions) {
    this.timeout = options?.timeout ?? 30000; // 默认 30 秒
  }

  async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), this.timeout)
      ),
    ]);
  }

  getTimeout(providerName: string, requestTimeout?: number, scene?: string): { timeout: number; source: string } {
    return {
      timeout: requestTimeout ?? this.timeout,
      source: 'config',
    };
  }

  recordResponseTime(providerName: string, responseTimeMs: number): void {
    // 预留响应时间记录
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}
