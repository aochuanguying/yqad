-- 修复发帖日志中缺失的 topic_name 字段
-- 从 topic_id 关联查询主题名称并更新

-- 查看需要修复的记录数
SELECT COUNT(*) as need_fix 
FROM post_logs pl 
WHERE (pl.topic_name IS NULL OR pl.topic_name = '') 
  AND pl.topic_id IS NOT NULL;

-- 执行更新（关联 topics 表）
UPDATE post_logs pl
INNER JOIN topics t ON pl.topic_id = t.id
SET pl.topic_name = t.title
WHERE (pl.topic_name IS NULL OR pl.topic_name = '')
  AND pl.topic_id IS NOT NULL;

-- 验证修复结果
SELECT COUNT(*) as fixed_count 
FROM post_logs pl 
WHERE pl.topic_name IS NOT NULL AND pl.topic_name != '';
