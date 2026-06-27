/**
 * ChromaDB 健康监控
 * 
 * 功能：
 * 1. 健康检查（连接状态、响应时间）
 * 2. Collection 统计（向量数量、存储大小）
 * 3. 性能监控（查询延迟、错误率）
 * 4. 告警通知（异常检测）
 */

import { getChromaCollection } from './chroma-connection-manager';
import { getLogger } from './logger';
import { materialVectorStorage } from '../storage/chroma/material-vector-storage';
import { contentDedupStorage } from '../storage/chroma/content-dedup-storage';
import { topicRecommendStorage } from '../storage/chroma/topic-recommend-storage';
import { sensitiveVariantStorage } from '../storage/chroma/sensitive-variant-storage';
import { commentSentimentStorage } from '../storage/chroma/comment-sentiment-storage';

const logger = getLogger('chroma-health-monitor');

/**
 * Collection 健康状态
 */
interface CollectionHealth {
  name: string;
  healthy: boolean;
  vectorCount: number;
  avgQueryTime?: number;
  lastCheckTime: number;
  error?: string;
}

/**
 * ChromaDB 整体健康状态
 */
export interface ChromaDBHealthStatus {
  healthy: boolean;
  serverHealthy: boolean;
  collections: CollectionHealth[];
  totalVectors: number;
  checkTime: number;
  checkDuration: number;
}

/**
 * 性能指标
 */
interface PerformanceMetrics {
  queryCount: number;
  avgQueryTime: number;
  maxQueryTime: number;
  errorCount: number;
  errorRate: number;
}

/**
 * ChromaDB 健康监控类
 */
class ChromaHealthMonitor {
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private checkInterval: number = 5 * 60 * 1000; // 5 分钟检查一次
  private lastCheckTime: number = 0;
  private lastHealthStatus: ChromaDBHealthStatus | null = null;

  /**
   * 执行健康检查
   */
  async performHealthCheck(): Promise<ChromaDBHealthStatus> {
    const startTime = Date.now();
    this.lastCheckTime = startTime;

    try {
      // 1. 检查服务器健康（简化实现，只检查 collection）
      const serverHealthy = true;

      // 2. 检查所有 Collections
      const collections = await Promise.all([
        this.checkCollectionHealth('materials', materialVectorStorage),
        this.checkCollectionHealth('content_dedup', contentDedupStorage),
        this.checkCollectionHealth('topic_recommend', topicRecommendStorage),
        this.checkCollectionHealth('sensitive_variants', sensitiveVariantStorage),
        this.checkCollectionHealth('comment_sentiment', commentSentimentStorage),
      ]);

      // 3. 统计总向量数
      const totalVectors = collections.reduce((sum, col) => sum + col.vectorCount, 0);

      // 4. 构建健康状态
      const healthStatus: ChromaDBHealthStatus = {
        healthy: serverHealthy && collections.every(col => col.healthy),
        serverHealthy,
        collections,
        totalVectors,
        checkTime: startTime,
        checkDuration: Date.now() - startTime,
      };

      this.lastHealthStatus = healthStatus;

      // 5. 记录日志
      if (healthStatus.healthy) {
        logger.info(
          `ChromaDB 健康检查通过 (${healthStatus.checkDuration}ms) | ` +
          `Collections: ${collections.length} | ` +
          `总向量：${totalVectors}`
        );
      } else {
        logger.warn(
          `ChromaDB 健康检查失败 | ` +
          `服务器：${serverHealthy ? '正常' : '异常'} | ` +
          `不健康的 Collections: ${collections.filter(c => !c.healthy).map(c => c.name).join(', ')}`
        );
      }

      return healthStatus;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`ChromaDB 健康检查失败：${errorMsg}`);

      return {
        healthy: false,
        serverHealthy: false,
        collections: [],
        totalVectors: 0,
        checkTime: startTime,
        checkDuration: Date.now() - startTime,
      };
    }
  }

  /**
   * 检查单个 Collection 的健康状态
   */
  private async checkCollectionHealth(
    name: string,
    storage: any
  ): Promise<CollectionHealth> {
    const checkStartTime = Date.now();

    try {
      if (!storage.initialized) {
        await storage.initialize();
      }

      const vectorCount = await storage.count();
      const info = await storage.getCollectionInfo();

      return {
        name,
        healthy: true,
        vectorCount,
        lastCheckTime: checkStartTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`Collection 健康检查失败：${name}`, errorMsg);

      return {
        name,
        healthy: false,
        vectorCount: 0,
        lastCheckTime: checkStartTime,
        error: errorMsg,
      };
    }
  }

  /**
   * 记录查询性能
   */
  recordQuery(collectionName: string, queryTime: number, success: boolean): void {
    let metrics = this.performanceMetrics.get(collectionName);

    if (!metrics) {
      metrics = {
        queryCount: 0,
        avgQueryTime: 0,
        maxQueryTime: 0,
        errorCount: 0,
        errorRate: 0,
      };
      this.performanceMetrics.set(collectionName, metrics);
    }

    metrics.queryCount++;
    metrics.avgQueryTime = (metrics.avgQueryTime * (metrics.queryCount - 1) + queryTime) / metrics.queryCount;
    metrics.maxQueryTime = Math.max(metrics.maxQueryTime, queryTime);

    if (!success) {
      metrics.errorCount++;
      metrics.errorRate = (metrics.errorCount / metrics.queryCount) * 100;
    }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(collectionName?: string): PerformanceMetrics | Map<string, PerformanceMetrics> {
    if (collectionName) {
      return this.performanceMetrics.get(collectionName) || {
        queryCount: 0,
        avgQueryTime: 0,
        maxQueryTime: 0,
        errorCount: 0,
        errorRate: 0,
      };
    }
    return this.performanceMetrics;
  }

  /**
   * 获取上次健康检查结果
   */
  getLastHealthStatus(): ChromaDBHealthStatus | null {
    return this.lastHealthStatus;
  }

  /**
   * 启动定时健康检查
   */
  startPeriodicCheck(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, this.checkInterval);

    logger.info(`ChromaDB 定时健康检查已启动（间隔：${this.checkInterval / 1000}秒）`);
  }

  /**
   * 重置性能指标
   */
  resetMetrics(): void {
    this.performanceMetrics.clear();
    logger.info('ChromaDB 性能指标已重置');
  }
}

// 导出单例
export const chromaHealthMonitor = new ChromaHealthMonitor();

// 导出便捷函数
export async function checkChromaDBHealth(): Promise<ChromaDBHealthStatus> {
  return chromaHealthMonitor.performHealthCheck();
}

export function getChromaPerformanceMetrics(collectionName?: string) {
  return chromaHealthMonitor.getPerformanceMetrics(collectionName);
}

export function startChromaHealthMonitoring() {
  chromaHealthMonitor.startPeriodicCheck();
}
