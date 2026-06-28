-- +migrate Up
-- 为 post_logs 表添加 task_id 字段，用于关联 AutoJS 回调
ALTER TABLE post_logs 
ADD COLUMN task_id VARCHAR(64) COMMENT '任务 ID（用于 AutoJS 回调关联）',
ADD INDEX idx_task_id (task_id);

-- +migrate Down
ALTER TABLE post_logs 
DROP INDEX idx_task_id,
DROP COLUMN task_id;
