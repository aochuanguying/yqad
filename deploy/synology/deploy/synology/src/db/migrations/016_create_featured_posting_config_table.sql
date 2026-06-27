-- 创建精选发帖配置表
CREATE TABLE IF NOT EXISTS featured_posting_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  min_content_chars INT DEFAULT 250,
  min_images INT DEFAULT 4,
  max_images INT DEFAULT 9,
  max_generate_retries INT DEFAULT 2,
  max_image_upload_retries INT DEFAULT 2,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认精选发帖配置（如果不存在）
INSERT INTO featured_posting_config (enabled, min_content_chars, min_images, max_images, max_generate_retries, max_image_upload_retries)
SELECT 1, 250, 4, 9, 2, 2
WHERE NOT EXISTS (SELECT 1 FROM featured_posting_config);
