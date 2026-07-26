-- 创建 auth_tokens 表，用于存储登录 Token
-- 执行时间：2026-07-26

CREATE TABLE IF NOT EXISTS auth_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键 ID',
  access_token TEXT NOT NULL COMMENT 'JWT 登录 Token',
  expires_at DATETIME NOT NULL COMMENT 'Token 过期时间',
  refreshed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后刷新时间',
  refresh_source VARCHAR(50) NOT NULL DEFAULT 'telecom_api' COMMENT '刷新来源：telecom_api, web_ui, response_header',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_expires_at (expires_at) COMMENT '过期时间索引，便于清理',
  INDEX idx_refreshed_at (refreshed_at) COMMENT '刷新时间索引，便于监控'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录 Token 存储表';

-- 插入初始记录（可选，首次运行时自动创建）
-- INSERT INTO auth_tokens (access_token, expires_at, refreshed_at, refresh_source)
-- VALUES ('', DATE_ADD(NOW(), INTERVAL 83 HOUR), NOW(), 'telecom_api');
