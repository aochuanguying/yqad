-- +migrate Up
CREATE TABLE IF NOT EXISTS compliance_reports (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) COMMENT '帖子 ID',
  title VARCHAR(200) NOT NULL COMMENT '帖子标题',
  content TEXT NOT NULL COMMENT '帖子内容',
  topic_id VARCHAR(64) COMMENT '主题 ID',
  topic_name VARCHAR(100) COMMENT '主题名称',
  trigger_type ENUM('auto', 'manual') NOT NULL COMMENT '触发类型',
  similarity_check JSON COMMENT '相似度检查结果',
  sensitive_word_check JSON COMMENT '敏感词检查结果',
  quality_score JSON COMMENT '质量评分',
  posting_interval_check JSON COMMENT '发帖间隔检查',
  passed BOOLEAN NOT NULL COMMENT '是否通过',
  reject_reasons JSON COMMENT '拒绝原因列表',
  check_duration INT NOT NULL COMMENT '检查耗时 (毫秒)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_post_id (post_id),
  INDEX idx_topic_id (topic_id),
  INDEX idx_passed (passed),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='合规性检查报告表';

-- +migrate Down
DROP TABLE IF EXISTS compliance_reports;
