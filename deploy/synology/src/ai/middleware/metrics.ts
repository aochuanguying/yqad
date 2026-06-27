/**
 * 指标收集
 */

export interface Metrics {
  successCount: number;
  failureCount: number;
  avgLatency: number;
}

export class MetricsCollector {
  recordSuccess(): void {}
  recordFailure(): void {}
  getMetrics(): Metrics {
    return {
      successCount: 0,
      failureCount: 0,
      avgLatency: 0,
    };
  }
}
