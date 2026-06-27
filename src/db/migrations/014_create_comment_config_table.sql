-- 创建评论配置表
CREATE TABLE IF NOT EXISTS comment_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 0,
  daily_limit INT DEFAULT 3,
  delay_min INT DEFAULT 60,
  delay_max INT DEFAULT 180,
  max_fetch_pages INT DEFAULT 5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认评论配置（如果不存在）
INSERT INTO comment_config (enabled, daily_limit, delay_min, delay_max, max_fetch_pages)
SELECT 0, 3, 60, 180, 5
WHERE NOT EXISTS (SELECT 1 FROM comment_config);
