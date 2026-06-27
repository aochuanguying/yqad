-- 创建车辆监控配置表
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认车辆监控配置（如果不存在）
INSERT INTO vehicle_monitor_config (
  enabled, interval_minutes, quick_interval_minutes, safe_distance_meters, move_threshold_meters,
  min_battery_volt, alert_phone, ha_base_url, ha_token, device_tracker_entity
)
SELECT 1, 15, 5, 50, 50, 11.5, '18953272532', 'https://ha.hxfssc.com:8088', 
       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3OWY2OGIxZmVjZGY0NTE3YjE2ZDI5NjgxN2I0ODJjYyIsImlhdCI6MTc4MTQ4Mzc4MiwiZXhwIjoyMDk2ODQzNzgyfQ.B4MZVRCLwc6w3cvftSNJWW2ZyzZY5jmj1NRcefnj-2g',
       'device_tracker.iphone'
WHERE NOT EXISTS (SELECT 1 FROM vehicle_monitor_config);
