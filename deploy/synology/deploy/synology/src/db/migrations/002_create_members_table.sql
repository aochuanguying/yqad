-- +migrate Up
CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
  email VARCHAR(100) UNIQUE COMMENT '邮箱',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  member_level ENUM('free', 'basic', 'premium', 'vip') DEFAULT 'free' COMMENT '会员等级',
  expires_at DATETIME COMMENT '会员过期时间',
  post_count INT DEFAULT 0 COMMENT '发帖数量',
  comment_count INT DEFAULT 0 COMMENT '评论数量',
  last_login_at DATETIME COMMENT '最后登录时间',
  last_login_ip VARCHAR(45) COMMENT '最后登录 IP',
  status ENUM('active', 'disabled', 'deleted') DEFAULT 'active' COMMENT '账号状态',
  deleted_at DATETIME COMMENT '删除时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_member_level (member_level),
  INDEX idx_expires_at (expires_at),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员表';

-- +migrate Down
DROP TABLE IF EXISTS members;
