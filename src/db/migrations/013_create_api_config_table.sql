-- 创建 API 配置表
CREATE TABLE IF NOT EXISTS api_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mode VARCHAR(50) NOT NULL DEFAULT 'mock',
  base_url VARCHAR(500) NOT NULL,
  timeout INT DEFAULT 10000,
  device_id VARCHAR(200) DEFAULT NULL,
  nick_name VARCHAR(100) DEFAULT NULL,
  ip_region VARCHAR(100) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认 API 配置（如果不存在）
INSERT INTO api_config (mode, base_url, timeout, device_id, nick_name, ip_region)
SELECT 'real', 'https://audi2c.faw-vw.com', 10000, 
       'AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1',
       '王大锤', '山东省'
WHERE NOT EXISTS (SELECT 1 FROM api_config);
