-- 创建内容去重配置表
CREATE TABLE IF NOT EXISTS content_deduplication_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  check_days INT DEFAULT 14,
  similarity_threshold DECIMAL(3,2) DEFAULT 0.70,
  title_weight DECIMAL(3,2) DEFAULT 0.40,
  retain_days INT DEFAULT 30,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认内容去重配置（如果不存在）
INSERT INTO content_deduplication_config (enabled, check_days, similarity_threshold, title_weight, retain_days)
SELECT 1, 14, 0.70, 0.40, 30
WHERE NOT EXISTS (SELECT 1 FROM content_deduplication_config);
