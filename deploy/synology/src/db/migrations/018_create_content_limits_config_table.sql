-- 创建内容限制配置表
CREATE TABLE IF NOT EXISTS content_limits_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comment_min INT DEFAULT 5,
  comment_max INT DEFAULT 20,
  post_min INT DEFAULT 100,
  post_max INT DEFAULT 480,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认内容限制配置（如果不存在）
INSERT INTO content_limits_config (comment_min, comment_max, post_min, post_max)
SELECT 5, 20, 100, 480
WHERE NOT EXISTS (SELECT 1 FROM content_limits_config);
