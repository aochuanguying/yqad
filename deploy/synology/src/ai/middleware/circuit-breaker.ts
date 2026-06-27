/**
 * 熔断器
 */

export class CircuitBreaker {
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return await fn();
  }
}
