-- 创建 AI 提供商配置表
CREATE TABLE IF NOT EXISTS ai_providers (
  id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增 ID',
  name VARCHAR(100) NOT NULL UNIQUE COMMENT '提供商名称',
  model VARCHAR(100) NOT NULL COMMENT '模型名称',
  base_url VARCHAR(500) NOT NULL COMMENT 'API Base URL',
  api_key VARCHAR(500) NOT NULL COMMENT 'API Key',
  temperature DECIMAL(3,2) DEFAULT 0.70 COMMENT '温度参数 (0.00-2.00)',
  max_tokens INT DEFAULT 4000 COMMENT '最大 Token 数',
  request_timeout INT DEFAULT 30000 COMMENT '请求超时 (毫秒)',
  enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  priority INT DEFAULT 0 COMMENT '优先级（数字越小优先级越高）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_priority (priority),
  INDEX idx_enabled (enabled),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 提供商配置表';

-- 插入默认数据（从配置文件同步）
INSERT INTO ai_providers (name, model, base_url, api_key, temperature, max_tokens, request_timeout, enabled, priority) VALUES
('gpt', 'gpt-5.5', 'http://47.104.95.133:16781/v1', 'sk-chenyao-JBr74LyRGDbxaih1OqtHJcFP2Og3n8BeroW82Y2P', 0.7, 1000, 30000, 1, 0),
('higpt', 'higpt', 'https://higpt.hxfssc.com:8088/v1', 'LqgltIIdlFVQFdi5EMa98HtRVXzq6KGA', 0.7, 6000, 60000, 1, 1)
ON DUPLICATE KEY UPDATE 
  model = VALUES(model),
  base_url = VALUES(base_url),
  api_key = VALUES(api_key),
  temperature = VALUES(temperature),
  max_tokens = VALUES(max_tokens),
  request_timeout = VALUES(request_timeout),
  priority = VALUES(priority);
