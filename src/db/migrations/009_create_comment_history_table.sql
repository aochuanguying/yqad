-- +migrate Up
CREATE TABLE IF NOT EXISTS comment_history (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) NOT NULL COMMENT '帖子 ID',
  comment_id VARCHAR(64) NOT NULL COMMENT '评论 ID',
  content TEXT NOT NULL COMMENT '评论内容',
  post_title VARCHAR(200) COMMENT '帖子标题',
  post_content TEXT COMMENT '帖子内容摘要',
  content_type VARCHAR(50) COMMENT '帖子类型',
  publish_time DATETIME COMMENT '帖子发布时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY uk_post_id (post_id),
  INDEX idx_comment_id (comment_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论历史表';

-- +migrate Down
DROP TABLE IF EXISTS comment_history;
