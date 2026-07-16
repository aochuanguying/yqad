/**
 * 车辆监控路由
 * 
 * 提供车辆监控状态查询、手动执行、告警记录管理等接口
 */

import { Router, Request, Response } from 'express';
import { getLogger } from '../../utils/logger';
import { getVehicleMonitorService } from '../services/vehicle-monitor-instance';
import { vehicleMonitorStorage } from '../../storage/mysql/vehicle-monitor-storage';

const logger = getLogger('vehicle-monitor-routes');
const router = Router();

/**
 * GET /api/vehicle-monitor/status
 * 获取车辆监控状态
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // 从数据库读取配置
    const vehicleConfig = await vehicleMonitorStorage.getConfig();
    const vehicleMonitorService = getVehicleMonitorService();
    
    const status = {
      enabled: vehicleConfig?.enabled !== false,
      config: vehicleConfig || {},
      lastStatus: vehicleMonitorService.getLastStatus(),
      lastMonitorTime: vehicleMonitorService.getLastMonitorTime(),
      alertLogs: vehicleMonitorService.getAlertLogs(10), // 最近 10 条
    };
    
    res.json({
      code: 'SUCCESS',
      message: '获取成功',
      data: status,
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`获取监控状态失败：${msg}`);
    res.status(500).json({
      code: 'ERROR',
      message: msg,
    });
  }
});

/**
 * POST /api/vehicle-monitor/execute
 * 手动执行一次车辆监控
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    // 从数据库读取配置
    const vehicleConfig = await vehicleMonitorStorage.getConfig();
    
    if (!vehicleConfig || vehicleConfig.enabled === false) {
      return res.status(400).json({
        code: 'NOT_ENABLED',
        message: '车辆监控功能未启用',
      });
    }
    
    const vehicleMonitorService = getVehicleMonitorService();
    
    logger.info('手动执行车辆监控');
    
    // 执行监控（等待完成）
    await vehicleMonitorService.runMonitor();
    
    // 等待 1 秒确保状态已更新
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result = {
      lastStatus: vehicleMonitorService.getLastStatus(),
      lastMonitorTime: vehicleMonitorService.getLastMonitorTime(),
    };
    
    logger.info('监控执行完成', {
      hasLastStatus: !!result.lastStatus,
      lastMonitorTime: result.lastMonitorTime,
    });
    
    res.json({
      code: 'SUCCESS',
      message: '监控执行成功',
      data: result,
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`手动执行监控失败：${msg}`);
    res.status(500).json({
      code: 'ERROR',
      message: `执行失败：${msg}`,
    });
  }
});

/**
 * POST /api/vehicle-monitor/config
 * 保存车辆监控配置
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const { 
      enabled, 
      alertPhone, 
      barkKey, 
      barkServer,
      haBaseUrl,
      haToken,
      deviceTrackerEntity,
      intervalMinutes,
      quickIntervalMinutes,
      safeDistanceMeters,
      moveThresholdMeters,
      minBatteryVolt
    } = req.body;
    
    // 获取当前配置
    const currentConfig = await vehicleMonitorStorage.getConfig();
    
    if (!currentConfig) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: '配置不存在',
      });
    }
    
    // 更新配置 - 保留原有值，使用前端传递的新值覆盖
    const newConfig = {
      ...currentConfig,
      enabled: enabled !== undefined ? enabled : currentConfig.enabled,
      alertPhone: alertPhone !== undefined ? alertPhone : currentConfig.alertPhone,
      barkKey: barkKey !== undefined ? barkKey : currentConfig.barkKey,
      barkServer: barkServer !== undefined ? barkServer : currentConfig.barkServer,
      haBaseUrl: haBaseUrl !== undefined ? haBaseUrl : currentConfig.haBaseUrl,
      haToken: haToken !== undefined ? haToken : currentConfig.haToken,
      deviceTrackerEntity: deviceTrackerEntity !== undefined ? deviceTrackerEntity : currentConfig.deviceTrackerEntity,
      intervalMinutes: intervalMinutes !== undefined ? intervalMinutes : currentConfig.intervalMinutes,
      quickIntervalMinutes: quickIntervalMinutes !== undefined ? quickIntervalMinutes : currentConfig.quickIntervalMinutes,
      safeDistanceMeters: safeDistanceMeters !== undefined ? safeDistanceMeters : currentConfig.safeDistanceMeters,
      moveThresholdMeters: moveThresholdMeters !== undefined ? moveThresholdMeters : currentConfig.moveThresholdMeters,
      minBatteryVolt: minBatteryVolt !== undefined ? minBatteryVolt : currentConfig.minBatteryVolt,
    };
    
    await vehicleMonitorStorage.saveConfig(newConfig);
    
    // 重新加载告警服务配置（热重载）
    const { alertService } = await import('../../services/alert-service');
    await alertService.reloadConfig();
    
    logger.info('车辆监控配置已保存', { 
      enabled: newConfig.enabled,
      hasAlertPhone: !!newConfig.alertPhone,
      hasBarkKey: !!newConfig.barkKey,
      hasHaToken: !!newConfig.haToken,
    });
    
    res.json({
      code: 'SUCCESS',
      message: '配置已保存',
      data: {
        enabled: newConfig.enabled,
        alertPhone: newConfig.alertPhone,
        barkKey: newConfig.barkKey ? newConfig.barkKey.substring(0, 8) + '***' : '',
        barkServer: newConfig.barkServer,
        haBaseUrl: newConfig.haBaseUrl,
        haToken: newConfig.haToken ? newConfig.haToken.substring(0, 8) + '***' : '',
        deviceTrackerEntity: newConfig.deviceTrackerEntity,
      },
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`保存车辆监控配置失败：${msg}`);
    res.status(500).json({
      code: 'ERROR',
      message: `保存失败：${msg}`,
    });
  }
});

/**
 * DELETE /api/vehicle-monitor/alerts
 * 清空告警记录
 */
router.delete('/alerts', async (req: Request, res: Response) => {
  try {
    const vehicleMonitorService = getVehicleMonitorService();
    vehicleMonitorService.clearAlertLogs();
    
    logger.info('告警记录已清空');
    
    res.json({
      code: 'SUCCESS',
      message: '记录已清空',
    });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`清空记录失败：${msg}`);
    res.status(500).json({
      code: 'ERROR',
      message: msg,
    });
  }
});

/**
 * GET /api/vehicle-monitor/device-location
 * 获取手机设备位置（通过 Home Assistant）
 */
router.get('/device-location', async (req: Request, res: Response) => {
  try {
    // 从数据库读取配置
    const vehicleConfig = await vehicleMonitorStorage.getConfig();
    
    if (!vehicleConfig?.haBaseUrl || !vehicleConfig?.haToken || !vehicleConfig?.deviceTrackerEntity) {
      return res.status(400).json({
        code: 'NOT_CONFIGURED',
        message: 'Home Assistant 设备追踪未配置',
      });
    }
    
    const vehicleMonitorService = getVehicleMonitorService();
    const deviceLocation = await vehicleMonitorService.getDeviceLocation();
    
    if (deviceLocation) {
      res.json({
        code: 'SUCCESS',
        message: '获取成功',
        data: deviceLocation,
      });
    } else {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: '未获取到设备位置',
      });
    }
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`获取设备位置失败：${msg}`);
    res.status(500).json({
      code: 'ERROR',
      message: `获取失败：${msg}`,
    });
  }
});

export default router;
