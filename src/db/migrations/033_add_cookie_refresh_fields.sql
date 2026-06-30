-- 添加 Cookie 刷新相关字段到 scheduler_config 表
-- 用于支持自动 Cookie 刷新功能

-- 使用存储过程来检查字段是否存在
DELIMITER $$

CREATE PROCEDURE add_cookie_refresh_columns()
BEGIN
    -- 检查并添加 cookie_refresh_enabled
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'scheduler_config' 
        AND COLUMN_NAME = 'cookie_refresh_enabled'
    ) THEN
        ALTER TABLE scheduler_config 
        ADD COLUMN cookie_refresh_enabled TINYINT(1) DEFAULT 0 COMMENT '是否启用 Cookie 刷新' AFTER material_processing_enabled;
    END IF;
    
    -- 检查并添加 cookie_refresh_cron
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'scheduler_config' 
        AND COLUMN_NAME = 'cookie_refresh_cron'
    ) THEN
        ALTER TABLE scheduler_config 
        ADD COLUMN cookie_refresh_cron VARCHAR(50) DEFAULT NULL COMMENT 'Cookie 刷新 Cron 表达式' AFTER cookie_refresh_enabled;
    END IF;
    
    -- 检查并添加 cookie_refresh_auto_enabled
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'scheduler_config' 
        AND COLUMN_NAME = 'cookie_refresh_auto_enabled'
    ) THEN
        ALTER TABLE scheduler_config 
        ADD COLUMN cookie_refresh_auto_enabled TINYINT(1) DEFAULT 0 COMMENT '是否启用自动 Cookie 刷新' AFTER cookie_refresh_cron;
    END IF;
END$$

DELIMITER ;

-- 执行存储过程
CALL add_cookie_refresh_columns();

-- 删除存储过程
DROP PROCEDURE IF EXISTS add_cookie_refresh_columns;
