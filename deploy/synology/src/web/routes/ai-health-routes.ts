import { Router, Request, Response } from 'express';
import { getAllHealthStatus, getFallbackHealthStatus, getProviderMetrics } from '../../ai/client';
import { getLogger } from '../../utils/logger';

const logger = getLogger('ai-health-routes');
const router = Router();

/**
 * 转换健康状态数据为前端友好的格式
 */
interface ProviderHealthData {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  successRate: number;
  avgResponseTime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimit: {
    availableTokens: number;
    isWhitelisted: boolean;
  };
  lastUpdated: string;
}

function calculateHealthStatus(
  circuitState: string,
  successRate: number
): 'healthy' | 'warning' | 'critical' {
  // 熔断器打开 = 严重
  if (circuitState === 'OPEN') {
    return 'critical';
  }
  
  // 成功率低于 80% = 严重
  if (successRate < 80) {
    return 'critical';
  }
  
  // 熔断器半开 或 成功率 80-90% = 警告
  if (circuitState === 'HALF_OPEN' || successRate < 90) {
    return 'warning';
  }
  
  // 其他情况 = 健康
  return 'healthy';
}

/**
 * GET /api/ai/health - 获取所有 Provider 健康状态
 */
router.get('/ai/health', (req: Request, res: Response) => {
  try {
    const fallbackStatus = getFallbackHealthStatus();
    const allHealthStatus = getAllHealthStatus();
    
    const providers: ProviderHealthData[] = [];
    
    // 遍历所有 provider
    for (const [name, healthStatus] of allHealthStatus.entries()) {
      const metrics = getProviderMetrics(name);
      const circuitStatus = fallbackStatus.get(name)?.circuit || { state: 'CLOSED' };
      const rateLimitStatus = fallbackStatus.get(name)?.rateLimit || { availableTokens: 0, isWhitelisted: false };
      
      const totalRequests = metrics.totalRequests || 0;
      const successfulRequests = metrics.successfulRequests || 0;
      const failedRequests = metrics.failedRequests || 0;
      const successRate = totalRequests > 0 
        ? Math.round((successfulRequests / totalRequests) * 100 * 100) / 100 
        : 100;
      const avgResponseTime = metrics.avgResponseTime || 0;
      
      const healthData: ProviderHealthData = {
        name,
        status: calculateHealthStatus(circuitStatus.state, successRate),
        circuitState: circuitStatus.state,
        successRate,
        avgResponseTime: Math.round(avgResponseTime),
        totalRequests,
        successfulRequests,
        failedRequests,
        rateLimit: {
          availableTokens: Math.round(rateLimitStatus.availableTokens),
          isWhitelisted: rateLimitStatus.isWhitelisted || false,
        },
        lastUpdated: new Date().toISOString(),
      };
      
      providers.push(healthData);
    }
    
    logger.debug(`返回 ${providers.length} 个 Provider 健康状态`);
    res.json({
      success: true,
      data: providers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`获取健康状态失败：${msg}`);
    res.status(500).json({ 
      success: false, 
      error: `获取健康状态失败：${msg}`,
    });
  }
});

/**
 * GET /api/ai/health/:provider - 获取单个 Provider 详细指标
 */
router.get('/ai/health/:provider', (req: Request, res: Response) => {
  const { provider } = req.params;
  
  try {
    const fallbackStatus = getFallbackHealthStatus();
    const allHealthStatus = getAllHealthStatus();
    
    if (!allHealthStatus.has(provider)) {
      res.status(404).json({
        success: false,
        error: `Provider "${provider}" 不存在`,
      });
      return;
    }
    
    const metrics = getProviderMetrics(provider);
    const circuitStatus = fallbackStatus.get(provider)?.circuit || { state: 'CLOSED' };
    const rateLimitStatus = fallbackStatus.get(provider)?.rateLimit || { availableTokens: 0, isWhitelisted: false };
    
    const totalRequests = metrics.totalRequests || 0;
    const successfulRequests = metrics.successfulRequests || 0;
    const failedRequests = metrics.failedRequests || 0;
    const successRate = totalRequests > 0 
      ? Math.round((successfulRequests / totalRequests) * 100 * 100) / 100 
      : 100;
    const avgResponseTime = metrics.avgResponseTime || 0;
    
    const healthData: ProviderHealthData = {
      name: provider,
      status: calculateHealthStatus(circuitStatus.state, successRate),
      circuitState: circuitStatus.state,
      successRate,
      avgResponseTime: Math.round(avgResponseTime),
      totalRequests,
      successfulRequests,
      failedRequests,
      rateLimit: {
        availableTokens: Math.round(rateLimitStatus.availableTokens),
        isWhitelisted: rateLimitStatus.isWhitelisted || false,
      },
      lastUpdated: new Date().toISOString(),
    };
    
    logger.debug(`返回 Provider "${provider}" 详细指标`);
    res.json({
      success: true,
      data: healthData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`获取 Provider "${provider}" 详细指标失败：${msg}`);
    res.status(500).json({ 
      success: false, 
      error: `获取详细指标失败：${msg}`,
    });
  }
});

export default router;
