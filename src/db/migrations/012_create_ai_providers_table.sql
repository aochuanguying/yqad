-- +migrate Up
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

-- +migrate Down
DROP TABLE IF EXISTS ai_providers;
