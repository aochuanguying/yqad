-- +migrate Up
ALTER TABLE post_logs 
ADD COLUMN task_id VARCHAR(64) COMMENT 'AutoJS 任务 ID' AFTER post_id,
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间' AFTER created_at,
ADD INDEX idx_task_id (task_id);

-- +migrate Down
ALTER TABLE post_logs 
DROP INDEX idx_task_id,
DROP COLUMN task_id;
