-- +migrate Up
CREATE TABLE IF NOT EXISTS pending_posts (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) UNIQUE NOT NULL COMMENT '任务 ID',
  member_id VARCHAR(64) COMMENT '会员 ID',
  title VARCHAR(200) NOT NULL COMMENT '帖子标题',
  content TEXT COMMENT '帖子内容',
  summary VARCHAR(500) COMMENT '摘要',
  cover_image_url VARCHAR(500) COMMENT '封面图',
  image_urls JSON COMMENT '图片 URL 列表',
  topic_id VARCHAR(64) COMMENT '主题 ID',
  topic_name VARCHAR(100) COMMENT '主题名称',
  mode ENUM('normal', 'featured') NOT NULL COMMENT '发帖模式',
  status ENUM('pending', 'confirmed', 'rejected', 'expired') NOT NULL DEFAULT 'pending' COMMENT '状态',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  confirmed_at DATETIME COMMENT '确认时间',
  INDEX idx_task_id (task_id),
  INDEX idx_member_id (member_id),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='待确认发帖表';

-- +migrate Down
DROP TABLE IF EXISTS pending_posts;
