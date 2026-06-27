-- 创建电信 API 配置表
CREATE TABLE IF NOT EXISTS telecom_api_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  api_url VARCHAR(500) DEFAULT NULL,
  api_token VARCHAR(500) DEFAULT NULL,
  alert_phone VARCHAR(20) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认电信 API 配置（如果不存在）
INSERT INTO telecom_api_config (enabled, api_url, api_token, alert_phone)
SELECT 1, 'http://10.6.0.2:5000', 'rDmpsGmKhmeGCt86h_Ovhxxtp1Mt2CxOu7p3Xac6xPg', '18953272532'
WHERE NOT EXISTS (SELECT 1 FROM telecom_api_config);
