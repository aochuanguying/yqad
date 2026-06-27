-- +migrate Up
CREATE TABLE IF NOT EXISTS post_history (
  id VARCHAR(64) PRIMARY KEY COMMENT '帖子 ID',
  title VARCHAR(200) NOT NULL COMMENT '帖子标题',
  topic VARCHAR(100) COMMENT '主题名称',
  content TEXT COMMENT '帖子内容',
  image_urls JSON COMMENT '图片 URL 列表',
  published_at DATETIME NOT NULL COMMENT '发布时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  INDEX idx_published_at (published_at),
  INDEX idx_topic (topic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='发帖历史表';

-- +migrate Down
DROP TABLE IF EXISTS post_history;
