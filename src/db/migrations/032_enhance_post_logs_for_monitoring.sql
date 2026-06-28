-- +migrate Up
-- 增强发帖日志表，添加性能指标和调试信息字段

-- 添加性能指标字段
ALTER TABLE post_logs 
  ADD COLUMN pipeline_timings JSON COMMENT 'Pipeline 各步骤耗时（毫秒）' AFTER created_at,
  ADD COLUMN total_duration BIGINT COMMENT '总执行时长（毫秒）' AFTER pipeline_timings,
  ADD COLUMN resource_usage JSON COMMENT '资源使用情况（图片数量、API 调用次数等）' AFTER total_duration;

-- 添加调试信息字段
ALTER TABLE post_logs
  ADD COLUMN error_stack TEXT COMMENT '错误堆栈信息' AFTER resource_usage,
  ADD COLUMN context_snapshot JSON COMMENT '错误发生时的上下文快照' AFTER error_stack,
  ADD COLUMN retry_history JSON COMMENT '重试历史记录' AFTER context_snapshot;

-- 添加索引提升查询性能
-- task_id 索引（如果还没有的话）
CREATE INDEX IF NOT EXISTS idx_task_id ON post_logs(task_id);

-- 复合索引用于按状态和触发方式组合查询
CREATE INDEX IF NOT EXISTS idx_status_trigger_created ON post_logs(status, trigger_type, created_at);

-- 按执行时长查询的索引
CREATE INDEX IF NOT EXISTS idx_total_duration ON post_logs(total_duration);

-- +migrate Down
-- 回滚迁移
DROP INDEX idx_total_duration ON post_logs;
DROP INDEX idx_status_trigger_created ON post_logs;
DROP INDEX idx_task_id ON post_logs;

ALTER TABLE post_logs
  DROP COLUMN retry_history,
  DROP COLUMN context_snapshot,
  DROP COLUMN error_stack,
  DROP COLUMN resource_usage,
  DROP COLUMN total_duration,
  DROP COLUMN pipeline_timings;
