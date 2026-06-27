-- 创建发帖配置表
CREATE TABLE IF NOT EXISTS post_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  mode VARCHAR(50) DEFAULT 'mock',
  daily_limit INT DEFAULT 1,
  avoid_repeat_days INT DEFAULT 7,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认发帖配置（如果不存在）
INSERT INTO post_config (enabled, mode, daily_limit, avoid_repeat_days)
SELECT 1, 'mock', 1, 7
WHERE NOT EXISTS (SELECT 1 FROM post_config);
