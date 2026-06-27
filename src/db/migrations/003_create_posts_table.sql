-- +migrate Up
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(64) PRIMARY KEY,
  member_id VARCHAR(64) NOT NULL COMMENT '作者 ID',
  title VARCHAR(200) NOT NULL COMMENT '标题',
  content TEXT COMMENT '内容',
  summary TEXT COMMENT '摘要',
  cover_image_url VARCHAR(500) COMMENT '封面图片 URL',
  status ENUM('draft', 'published', 'deleted') DEFAULT 'draft' COMMENT '状态',
  view_count INT DEFAULT 0 COMMENT '浏览数',
  like_count INT DEFAULT 0 COMMENT '点赞数',
  comment_count INT DEFAULT 0 COMMENT '评论数',
  published_at DATETIME COMMENT '发布时间',
  scheduled_at DATETIME COMMENT '定时发布时间',
  featured BOOLEAN DEFAULT FALSE COMMENT '是否精选',
  deleted_at DATETIME COMMENT '删除时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_member_id (member_id),
  INDEX idx_status (status),
  INDEX idx_published_at (published_at),
  INDEX idx_created_at (created_at),
  INDEX idx_featured (featured)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帖子表';

-- +migrate Down
DROP TABLE IF EXISTS posts;
