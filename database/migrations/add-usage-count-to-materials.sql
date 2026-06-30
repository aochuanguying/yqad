-- 添加 usage_count 字段到 material_records 表
ALTER TABLE material_records 
ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0 COMMENT '使用次数',
ADD COLUMN IF NOT EXISTS last_used_date DATETIME NULL COMMENT '最后使用日期';
