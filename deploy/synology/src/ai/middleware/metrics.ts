/**
 * 指标收集器
 */

export interface ProviderMetrics {
  name: string;
  successCount: number;
  failureCount: number;
  avgLatency: number;
  lastError?: string;
}

export class MetricsCollector {
  private metrics: Map<string, ProviderMetrics> = new Map();

  recordSuccess(providerName: string, latencyMs: number): void {
    const metric = this.getOrCreateMetric(providerName);
    metric.successCount++;
    metric.avgLatency = (metric.avgLatency * (metric.successCount - 1) + latencyMs) / metric.successCount;
  }

  recordFailure(providerName: string, error: string): void {
    const metric = this.getOrCreateMetric(providerName);
    metric.failureCount++;
    metric.lastError = error;
  }

  recordRequest(providerName: string, success: boolean, latencyMs: number, metadata?: any): void {
    if (success) {
      this.recordSuccess(providerName, latencyMs);
    } else {
      this.recordFailure(providerName, metadata?.errorMessage || 'Unknown error');
    }
  }

  updateCircuitState(providerName: string, state: string): void {
    // 预留电路状态更新接口
  }

  getMetrics(providerName: string): ProviderMetrics | undefined {
    return this.metrics.get(providerName);
  }

  getHealthStatus(): any {
    return { status: 'healthy', providers: Array.from(this.metrics.values()) };
  }

  private getOrCreateMetric(providerName: string): ProviderMetrics {
    if (!this.metrics.has(providerName)) {
      this.metrics.set(providerName, {
        name: providerName,
        successCount: 0,
        failureCount: 0,
        avgLatency: 0,
      });
    }
    return this.metrics.get(providerName)!;
  }
}

export const metricsCollector = new MetricsCollector();
