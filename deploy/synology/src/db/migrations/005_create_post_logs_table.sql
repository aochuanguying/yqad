-- +migrate Up
CREATE TABLE IF NOT EXISTS post_logs (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) COMMENT '帖子 ID',
  title VARCHAR(200) NOT NULL COMMENT '帖子标题',
  topic_id VARCHAR(64) COMMENT '主题 ID',
  topic_name VARCHAR(100) COMMENT '主题名称',
  content TEXT COMMENT '帖子内容',
  image_urls JSON COMMENT '图片 URL 列表',
  status ENUM('success', 'failed', 'pending') NOT NULL COMMENT '发帖状态',
  error_message TEXT COMMENT '错误信息',
  mode ENUM('normal', 'featured') NOT NULL COMMENT '发帖模式',
  trigger_type ENUM('auto', 'manual') NOT NULL COMMENT '触发类型',
  compliance_report_id VARCHAR(64) COMMENT '合规检查报告 ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_post_id (post_id),
  INDEX idx_topic_id (topic_id),
  INDEX idx_status (status),
  INDEX idx_mode (mode),
  INDEX idx_trigger_type (trigger_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='发帖日志表';

-- +migrate Down
DROP TABLE IF EXISTS post_logs;
