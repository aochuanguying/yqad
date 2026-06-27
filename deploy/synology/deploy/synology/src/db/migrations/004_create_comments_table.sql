-- +migrate Up
CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) NOT NULL COMMENT '帖子 ID',
  member_id VARCHAR(64) NOT NULL COMMENT '评论者 ID',
  parent_id VARCHAR(64) COMMENT '父评论 ID（用于回复）',
  content TEXT NOT NULL COMMENT '评论内容',
  status ENUM('pending', 'approved', 'rejected', 'deleted') DEFAULT 'approved' COMMENT '状态',
  ip_address VARCHAR(45) COMMENT '评论 IP',
  user_agent VARCHAR(500) COMMENT '用户代理',
  approved_at DATETIME COMMENT '审核通过时间',
  approved_by VARCHAR(64) COMMENT '审核者 ID',
  rejected_at DATETIME COMMENT '审核拒绝时间',
  rejected_by VARCHAR(64) COMMENT '拒绝者 ID',
  deleted_at DATETIME COMMENT '删除时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  edited_at DATETIME COMMENT '编辑时间',
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
  INDEX idx_post_id (post_id),
  INDEX idx_member_id (member_id),
  INDEX idx_parent_id (parent_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';

-- +migrate Down
DROP TABLE IF EXISTS comments;
