/**
 * 超时控制器
 * 模型的超时时间由具体模型设置控制，不使用全局超时
 */

export interface TimeoutOptions {
  timeout?: number;
}

export class TimeoutController {
  constructor(options?: TimeoutOptions) {
    // 不设置全局超时，超时由每个模型自己的 requestTimeout 控制
  }

  async withTimeout<T>(promise: Promise<T>): Promise<T> {
    // 不使用全局超时，由调用者控制
    return promise;
  }

  /**
   * 获取超时时间 - 直接使用模型的 requestTimeout，不使用全局配置
   * @param providerName - Provider 名称（未使用）
   * @param requestTimeout - 模型自己的超时设置
   * @param scene - 场景（未使用）
   * @returns 超时时间和来源
   */
  getTimeout(providerName: string, requestTimeout?: number, scene?: string): { timeout: number; source: string } {
    // 直接使用模型的超时设置，默认 120 秒
    return {
      timeout: requestTimeout ?? 120000,
      source: 'model',
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
