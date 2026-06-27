-- 创建调度器配置表
CREATE TABLE IF NOT EXISTS scheduler_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comment_cron VARCHAR(50) DEFAULT '0 10 * * *',
  comment_random_offset_min INT DEFAULT 0,
  comment_random_offset_max INT DEFAULT 600,
  post_cron VARCHAR(50) DEFAULT '0 12 * * *',
  post_random_offset_min INT DEFAULT 0,
  post_random_offset_max INT DEFAULT 360,
  material_processing_interval_minutes INT DEFAULT 45,
  material_processing_enabled TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认调度器配置（如果不存在）
INSERT INTO scheduler_config (
  comment_cron, comment_random_offset_min, comment_random_offset_max,
  post_cron, post_random_offset_min, post_random_offset_max,
  material_processing_interval_minutes, material_processing_enabled
)
SELECT '0 10 * * *', 0, 600, '0 12 * * *', 0, 360, 45, 1
WHERE NOT EXISTS (SELECT 1 FROM scheduler_config);
