import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';
import { getVehicleTokenStorage } from '../redis/vehicle-token-storage';

const logger = getLogger('vehicle-monitor-storage');

// 延迟获取 vehicleTokenStorage，避免模块加载时 Redis 未初始化
function getVehicleToken() {
  return getVehicleTokenStorage();
}

export interface VehicleMonitorConfig {
  enabled: boolean;
  intervalMinutes: number;
  quickIntervalMinutes: number;
  safeDistanceMeters: number;
  moveThresholdMeters: number;
  minBatteryVolt: number;
  alertPhone: string;
  haBaseUrl: string;
  haToken: string;
  deviceTrackerEntity: string;
  token: string;
}

class VehicleMonitorStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['vehicle_monitor_config']);
      if (rows.length === 0) {
        logger.warn('vehicle_monitor_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('车辆监控配置存储初始化完成');
    } catch (error) {
      logger.error('车辆监控配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS vehicle_monitor_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        interval_minutes INT DEFAULT 15,
        quick_interval_minutes INT DEFAULT 5,
        safe_distance_meters INT DEFAULT 50,
        move_threshold_meters INT DEFAULT 50,
        min_battery_volt DECIMAL(3,1) DEFAULT 11.5,
        alert_phone VARCHAR(20) DEFAULT NULL,
        ha_base_url VARCHAR(500) DEFAULT NULL,
        ha_token VARCHAR(1000) DEFAULT NULL,
        device_tracker_entity VARCHAR(200) DEFAULT 'device_tracker.iphone',
        token VARCHAR(1000) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ vehicle_monitor_config 表创建成功');
    await this.query(`
      INSERT INTO vehicle_monitor_config (
        enabled, interval_minutes, quick_interval_minutes, safe_distance_meters, move_threshold_meters,
        min_battery_volt, alert_phone, ha_base_url, ha_token, device_tracker_entity, token
      )
      SELECT 1, 15, 5, 50, 50, 11.5, '18953272532', 'https://ha.hxfssc.com:8088', 
             'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3OWY2OGIxZmVjZGY0NTE3YjE2ZDI5NjgxN2I0ODJjYyIsImlhdCI6MTc4MTQ4Mzc4MiwiZXhwIjoyMDk2ODQzNzgyfQ.B4MZVRCLwc6w3cvftSNJWW2ZyzZY5jmj1NRcefnj-2g',
             'device_tracker.iphone', ''
      WHERE NOT EXISTS (SELECT 1 FROM vehicle_monitor_config)
    `);
    logger.info('✅ 默认车辆监控配置数据插入成功');
  }

  async getConfig(): Promise<VehicleMonitorConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, interval_minutes, quick_interval_minutes, safe_distance_meters, move_threshold_meters, min_battery_volt, alert_phone, ha_base_url, ha_token, device_tracker_entity, token FROM vehicle_monitor_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      
      // 优先从 Redis 读取 Token（动态更新）
      let token = row.token || '';
      try {
        const redisToken = await getVehicleToken().getToken();
        if (redisToken) {
          token = redisToken;
        }
      } catch (redisError) {
        logger.warn('从 Redis 读取车辆 Token 失败:', redisError instanceof Error ? redisError.message : String(redisError));
      }
      
      return {
        enabled: row.enabled === 1,
        intervalMinutes: row.interval_minutes,
        quickIntervalMinutes: row.quick_interval_minutes,
        safeDistanceMeters: row.safe_distance_meters,
        moveThresholdMeters: row.move_threshold_meters,
        minBatteryVolt: parseFloat(row.min_battery_volt),
        alertPhone: row.alert_phone,
        haBaseUrl: row.ha_base_url,
        haToken: row.ha_token,
        deviceTrackerEntity: row.device_tracker_entity,
        token: token,
      };
    } catch (error) {
      logger.error('获取车辆监控配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: VehicleMonitorConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM vehicle_monitor_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO vehicle_monitor_config (
            enabled, interval_minutes, quick_interval_minutes, safe_distance_meters, move_threshold_meters,
            min_battery_volt, alert_phone, ha_base_url, ha_token, device_tracker_entity
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            config.enabled ? 1 : 0, config.intervalMinutes, config.quickIntervalMinutes,
            config.safeDistanceMeters, config.moveThresholdMeters, config.minBatteryVolt,
            config.alertPhone, config.haBaseUrl, config.haToken, config.deviceTrackerEntity
          ]
        );
        logger.info('车辆监控配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE vehicle_monitor_config 
           SET enabled = ?, interval_minutes = ?, quick_interval_minutes = ?, safe_distance_meters = ?, 
               move_threshold_meters = ?, min_battery_volt = ?, alert_phone = ?, ha_base_url = ?, 
               ha_token = ?, device_tracker_entity = ?
           WHERE id = ?`,
          [
            config.enabled ? 1 : 0, config.intervalMinutes, config.quickIntervalMinutes,
            config.safeDistanceMeters, config.moveThresholdMeters, config.minBatteryVolt,
            config.alertPhone, config.haBaseUrl, config.haToken, config.deviceTrackerEntity,
            rows[0].id
          ]
        );
        logger.info('车辆监控配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存车辆监控配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: VehicleMonitorStorage | null = null;
export function getVehicleMonitorStorage(): VehicleMonitorStorage {
  if (!instance) instance = new VehicleMonitorStorage();
  return instance;
}
export const vehicleMonitorStorage = getVehicleMonitorStorage();
