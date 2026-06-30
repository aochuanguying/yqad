-- 添加 Cookie 定时刷新配置字段到 scheduler_config 表
ALTER TABLE scheduler_config 
ADD COLUMN cookie_refresh_enabled TINYINT(1) DEFAULT 0 COMMENT '是否启用 Cookie 自动刷新',
ADD COLUMN cookie_refresh_cron VARCHAR(50) DEFAULT '0 2 * * *' COMMENT 'Cookie 刷新定时表达式（默认每天凌晨 2 点）',
ADD COLUMN cookie_refresh_auto_enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用到期自动刷新（提前 1 小时）';

-- 更新现有记录，设置默认值
UPDATE scheduler_config 
SET cookie_refresh_enabled = 0, 
    cookie_refresh_cron = '0 2 * * *',
    cookie_refresh_auto_enabled = 1
WHERE cookie_refresh_enabled IS NULL;
