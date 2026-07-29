export interface RetryOptions {
  maxRetries?: number;   // 默认 3
  baseDelay?: number;    // 基础延迟（毫秒），默认 1000
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * 指数退避重试
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, onRetry } = options;
  let lastError: Error = new Error('未知错误');
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      if (attempt > maxRetries) {
        break;
      }

      if (onRetry) {
        onRetry(err, attempt);
      }

      // 指数退避：1s, 2s, 4s...
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const totalTime = Date.now() - startTime;
  const enrichedError = new Error(
    `${lastError.message} (重试 ${maxRetries} 次后失败，总耗时 ${totalTime}ms)`
  );
  (enrichedError as any).originalError = lastError;
  (enrichedError as any).retryCount = maxRetries;
  (enrichedError as any).totalDuration = totalTime;
  throw enrichedError;
}
