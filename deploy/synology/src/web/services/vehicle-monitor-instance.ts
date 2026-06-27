/**
 * 车辆监控服务单例
 * 
 * 提供全局唯一的车辆监控服务实例，用于路由和服务层访问
 */

import { vehicleMonitorService } from '../../services/vehicle-monitor-service';

/**
 * 获取车辆监控服务单例
 */
export function getVehicleMonitorService() {
  return vehicleMonitorService;
}
