-- 创建 AutoJS API 配置表
CREATE TABLE IF NOT EXISTS autojs_api_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  base_url VARCHAR(500) DEFAULT NULL,
  api_token VARCHAR(500) DEFAULT NULL,
  post_script VARCHAR(100) DEFAULT 'audi_post.js',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认 AutoJS API 配置（如果不存在）
INSERT INTO autojs_api_config (enabled, base_url, api_token, post_script)
SELECT 1, 'http://10.6.0.2:8899', 'api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2', 'audi_post.js'
WHERE NOT EXISTS (SELECT 1 FROM autojs_api_config);
