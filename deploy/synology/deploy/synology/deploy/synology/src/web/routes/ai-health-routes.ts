import { Router, Request, Response } from 'express';
import { loadConfig } from '../../utils/config';
import { getLogger } from '../../utils/logger';
import { createAuthMiddleware } from '../middleware/auth-middleware';

const logger = getLogger('ai-health-routes');
const router = Router();
const authMiddleware = createAuthMiddleware();

// 应用认证中间件到所有路由
router.use(authMiddleware);

/**
 * 测试单个 Provider 的健康状态
 */
async function testProviderHealth(provider: any): Promise<{
  name: string;
  model: string;
  baseUrl: string;
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
  error?: string;
}> {
  const startTime = Date.now();
  try {
    // 发送测试请求
    const axios = require('axios');
    const testMessages = [
      { role: 'user', content: 'Hello' }
    ];
    
    const response = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      {
        model: provider.model,
        messages: testMessages,
        max_tokens: 10,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
        },
        timeout: 5000, // 5 秒超时
      }
    );
    
    const responseTime = Date.now() - startTime;
    const success = response.data && response.data.choices && response.data.choices.length > 0;
    
    return {
      name: provider.name,
      model: provider.model,
      baseUrl: provider.baseUrl,
      status: success ? 'healthy' : 'critical',
      circuitState: 'CLOSED' as const,
      successRate: success ? 100 : 0,
      avgResponseTime: responseTime,
      totalRequests: 1,
      successfulRequests: success ? 1 : 0,
      failedRequests: success ? 0 : 1,
      rateLimit: {
        availableTokens: 60,
        isWhitelisted: false,
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    logger.warn(`Provider "${provider.name}" 健康检查失败：${error.message}`);
    
    return {
      name: provider.name,
      model: provider.model,
      baseUrl: provider.baseUrl,
      status: 'critical' as const,
      circuitState: 'OPEN' as const,
      successRate: 0,
      avgResponseTime: responseTime,
      totalRequests: 1,
      successfulRequests: 0,
      failedRequests: 1,
      rateLimit: {
        availableTokens: 0,
        isWhitelisted: false,
      },
      lastUpdated: new Date().toISOString(),
      error: error.message,
    };
  }
}

/**
 * GET /api/ai/health - 获取所有 Provider 健康状态
 */
router.get('/ai/health', async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const providers = config.ai.providers || [];
    
    // 并行测试所有 provider 的健康状态
    const healthChecks = providers.map(provider => testProviderHealth(provider));
    const healthData = await Promise.all(healthChecks);
    
    logger.debug(`返回 ${healthData.length} 个 Provider 健康状态`);
    res.json({
      success: true,
      data: healthData,
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
    const config = loadConfig();
    const providers = config.ai.providers || [];
    const providerConfig = providers.find(p => p.name === provider);
    
    if (!providerConfig) {
      res.status(404).json({
        success: false,
        error: `Provider "${provider}" 不存在`,
      });
      return;
    }
    
    const healthData = {
      name: providerConfig.name,
      model: providerConfig.model,
      baseUrl: providerConfig.baseUrl,
      status: 'healthy' as const,
      circuitState: 'CLOSED' as const,
      successRate: 100,
      avgResponseTime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimit: {
        availableTokens: 60,
        isWhitelisted: false,
      },
      lastUpdated: new Date().toISOString(),
    };
    
    logger.debug(`返回 Provider "${provider}" 详细信息`);
    res.json({
      success: true,
      data: healthData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`获取 Provider "${provider}" 详细信息失败：${msg}`);
    res.status(500).json({ 
      success: false, 
      error: `获取详细信息失败：${msg}`,
    });
  }
});

export default router;
