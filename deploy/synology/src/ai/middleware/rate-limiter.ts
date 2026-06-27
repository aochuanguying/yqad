/**
 * 速率限制器
 */

export class RateLimiter {
  async acquire(): Promise<boolean> {
    return true;
  }
}
