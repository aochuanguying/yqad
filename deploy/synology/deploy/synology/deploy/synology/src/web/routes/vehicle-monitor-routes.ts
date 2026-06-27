/**
 * 车辆监控路由
 * 
 * 提供车辆监控状态查询、手动执行、告警记录管理等接口
 */

import { Router, Request, Response } from 'express';
import { loadConfig } from '../../utils/config';
import { getLogger } from '../../utils/logger';
import { getVehicleMonitorService } from '../services/vehicle-monitor-instance';

const logger = getLogger('vehicle-monitor-routes');
const router = Router();

/**
 * GET /api/vehicle-monitor/status
 * 获取车辆监控状态
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const vehicleMonitorService = getVehicleMonitorService();
    
    const status = {
      enabled: config.vehicleMonitor?.enabled !== false,
      config: config.vehicleMonitor || {},
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
    const config = loadConfig();
    
    if (!config.vehicleMonitor || config.vehicleMonitor.enabled === false) {
      return res.status(400).json({
        code: 'NOT_ENABLED',
        message: '车辆监控功能未启用',
      });
    }
    
    const vehicleMonitorService = getVehicleMonitorService();
    
    logger.info('手动执行车辆监控');
    
    // 执行监控
    await vehicleMonitorService.runMonitor();
    
    res.json({
      code: 'SUCCESS',
      message: '监控执行成功',
      data: {
        lastStatus: vehicleMonitorService.getLastStatus(),
        lastMonitorTime: vehicleMonitorService.getLastMonitorTime(),
      },
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
    const config = loadConfig();
    
    if (!config.vehicleMonitor?.haBaseUrl || !config.vehicleMonitor?.haToken || !config.vehicleMonitor?.deviceTrackerEntity) {
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
