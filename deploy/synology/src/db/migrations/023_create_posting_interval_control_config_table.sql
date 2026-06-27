-- 创建发帖间隔控制配置表
CREATE TABLE IF NOT EXISTS posting_interval_control_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  min_interval_days INT DEFAULT 5,
  whitelist VARCHAR(1000) DEFAULT NULL,
  enable_emergency_override TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认发帖间隔控制配置（如果不存在）
INSERT INTO posting_interval_control_config (enabled, min_interval_days, whitelist, enable_emergency_override)
SELECT 1, 5, NULL, 0
WHERE NOT EXISTS (SELECT 1 FROM posting_interval_control_config);
