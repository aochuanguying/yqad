/**
 * Telecom API 配置和告警历史路由
 */

import { Router, Request, Response } from 'express';
import { loadConfig } from '../../utils/config';
import { getLogger } from '../../utils/logger';
import { alertService } from '../../services/alert-service';
import { telecomClient } from '../../services/telecom-client';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

const logger = getLogger('telecom-routes');
const router = Router();

const CONFIG_FILE_PATH = './config/default.yaml';

// ===================== 类型定义 =====================

interface TelecomConfigRequest {
  enabled: boolean;
  apiUrl: string;
  apiToken: string;
  alertPhone: string;
}

// ===================== 路由实现 =====================

/**
 * GET /api/telecom-config
 * 获取当前 Telecom API 配置
 */
router.get('/telecom-config', async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const telecomConfig = (config as any).telecomApi || {
      enabled: false,
      apiUrl: '',
      apiToken: '',
      alertPhone: '',
    };

    // Token 掩码处理（显示前 8 位和后 4 位）
    const maskedToken = maskToken(telecomConfig.apiToken || '');

    res.json({
      success: true,
      config: {
        enabled: telecomConfig.enabled,
        apiUrl: telecomConfig.apiUrl,
        apiToken: maskedToken,
        apiTokenRaw: telecomConfig.apiToken || '', // 用于编辑时显示完整 Token
        alertPhone: telecomConfig.alertPhone,
      },
    });
  } catch (error) {
    logger.error('获取 Telecom 配置失败', error);
    res.status(500).json({
      success: false,
      error: '获取配置失败',
    });
  }
});

/**
 * POST /api/telecom-config
 * 保存 Telecom API 配置
 */
router.post('/telecom-config', async (req: Request, res: Response) => {
  try {
    const { enabled, apiUrl, apiToken, alertPhone }: TelecomConfigRequest = req.body;

    // 验证必填字段
    if (enabled && (!apiUrl || !apiToken || !alertPhone)) {
      return res.status(400).json({
        success: false,
        error: '启用时必须提供 API 地址、Token 和告警手机号',
      });
    }

    // 验证手机号格式（11 位中国大陆手机号）
    if (enabled && alertPhone && !/^1\d{10}$/.test(alertPhone)) {
      return res.status(400).json({
        success: false,
        error: '手机号格式不正确，请输入 11 位中国大陆手机号',
      });
    }

    // 读取配置文件
    const configFileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    const configData: any = yaml.load(configFileContent) || {};

    // 更新配置
    if (!configData.telecomApi) {
      configData.telecomApi = {};
    }
    configData.telecomApi.enabled = enabled;
    configData.telecomApi.apiUrl = apiUrl;
    configData.telecomApi.apiToken = apiToken;
    configData.telecomApi.alertPhone = alertPhone;

    // 写回配置文件
    const newYamlContent = yaml.dump(configData, {
      indent: 2,
      lineWidth: -1, // 不限制行宽
      noRefs: true,  // 不使用引用
    });
    fs.writeFileSync(CONFIG_FILE_PATH, newYamlContent, 'utf8');

    logger.info('Telecom 配置已保存', { enabled, apiUrl, alertPhone });

    // 重新加载告警服务配置
    alertService.reloadConfig();

    res.json({
      success: true,
      message: '配置已保存',
    });
  } catch (error) {
    logger.error('保存 Telecom 配置失败', error);
    res.status(500).json({
      success: false,
      error: '保存配置失败',
    });
  }
});

/**
 * POST /api/telecom-test
 * 测试 Telecom API 连接
 */
router.post('/telecom-test', async (req: Request, res: Response) => {
  try {
    const { apiUrl, apiToken }: { apiUrl: string; apiToken: string } = req.body;

    if (!apiUrl || !apiToken) {
      return res.status(400).json({
        success: false,
        error: 'API 地址和 Token 不能为空',
      });
    }

    logger.info('测试 Telecom API 连接', { apiUrl });
    const result = await telecomClient.testConnection(apiUrl, apiToken);

    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'API 连接正常',
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || '连接失败',
      });
    }
  } catch (error) {
    logger.error('测试 Telecom API 连接失败', error);
    res.status(500).json({
      success: false,
      error: '测试连接失败',
    });
  }
});

/**
 * GET /api/alert-history
 * 获取告警历史记录
 */
router.get('/alert-history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const clampedLimit = Math.min(limit, 100); // 最大 100 条

    const history = alertService.getAlertHistory(clampedLimit);

    res.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    logger.error('获取告警历史失败', error);
    res.status(500).json({
      success: false,
      error: '获取告警历史失败',
    });
  }
});

/**
 * GET /api/alert-stats
 * 获取告警统计信息
 */
router.get('/alert-stats', async (req: Request, res: Response) => {
  try {
    const stats = alertService.getAlertStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('获取告警统计失败', error);
    res.status(500).json({
      success: false,
      error: '获取告警统计失败',
    });
  }
});

// ===================== 辅助函数 =====================

/**
 * Token 掩码处理（显示前 8 位和后 4 位）
 */
function maskToken(token: string): string {
  if (!token || token.length <= 12) {
    return '***';
  }
  return token.substring(0, 8) + '***' + token.substring(token.length - 4);
}

// ===================== 导出 =====================

export default router;
