-- 创建互联网参考配置表
CREATE TABLE IF NOT EXISTS internet_reference_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  search_keywords VARCHAR(500) DEFAULT NULL,
  max_results INT DEFAULT 5,
  timeout INT DEFAULT 90000,
  rate_limit_per_hour INT DEFAULT 10,
  platform VARCHAR(50) DEFAULT 'xiaohongshu',
  watermark_removal_enabled TINYINT(1) DEFAULT 1,
  watermark_removal_timeout INT DEFAULT 30000,
  watermark_removal_max_retries INT DEFAULT 2,
  watermark_removal_batch_size INT DEFAULT 5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认互联网参考配置（如果不存在）
INSERT INTO internet_reference_config (
  enabled, search_keywords, max_results, timeout, rate_limit_per_hour, platform,
  watermark_removal_enabled, watermark_removal_timeout, watermark_removal_max_retries, watermark_removal_batch_size
)
SELECT 1, '奥迪，奥迪 Q5L，奥迪用车，自驾游，露营', 5, 90000, 10, 'xiaohongshu', 1, 30000, 2, 5
WHERE NOT EXISTS (SELECT 1 FROM internet_reference_config);
