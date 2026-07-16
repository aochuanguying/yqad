-- ============================================================
-- 数据库清理迁移脚本
-- 创建日期：2026-07-08
-- 说明：删除多余的表和字段
-- ============================================================

-- ==================== 1. 删除多余的表 ====================

-- 删除未使用的表
DROP TABLE IF EXISTS `daily_summaries`;
DROP TABLE IF EXISTS `topic_material_usages`;
DROP TABLE IF EXISTS `topic_sub_direction_usages`;
DROP TABLE IF EXISTS `topic_sub_directions`;

-- ==================== 2. 删除多余的字段 ====================

-- scheduler_config 表删除多余字段
-- 这些字段应该只在 network_post_config 表中按平台独立管理
-- 注意：MySQL 不支持 DROP COLUMN IF EXISTS，需要先检查
SET @dbname = DATABASE();

-- 检查并删除 cookie_version
SET @sql = NULL;
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 
      CONCAT('ALTER TABLE `', @dbname, '`.`scheduler_config` DROP COLUMN `cookie_version`')
    ELSE NULL
  END INTO @sql
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = @dbname 
  AND TABLE_NAME = 'scheduler_config' 
  AND COLUMN_NAME = 'cookie_version';

PREPARE stmt FROM IFNULL(@sql, 'SELECT "Column cookie_version does not exist"');
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并删除 last_refresh_time
SET @sql = NULL;
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 
      CONCAT('ALTER TABLE `', @dbname, '`.`scheduler_config` DROP COLUMN `last_refresh_time`')
    ELSE NULL
  END INTO @sql
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = @dbname 
  AND TABLE_NAME = 'scheduler_config' 
  AND COLUMN_NAME = 'last_refresh_time';

PREPARE stmt FROM IFNULL(@sql, 'SELECT "Column last_refresh_time does not exist"');
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并删除 next_refresh_time
SET @sql = NULL;
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 
      CONCAT('ALTER TABLE `', @dbname, '`.`scheduler_config` DROP COLUMN `next_refresh_time`')
    ELSE NULL
  END INTO @sql
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = @dbname 
  AND TABLE_NAME = 'scheduler_config' 
  AND COLUMN_NAME = 'next_refresh_time';

PREPARE stmt FROM IFNULL(@sql, 'SELECT "Column next_refresh_time does not exist"');
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查并删除 cookie_refresh_logs
SET @sql = NULL;
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 
      CONCAT('ALTER TABLE `', @dbname, '`.`scheduler_config` DROP COLUMN `cookie_refresh_logs`')
    ELSE NULL
  END INTO @sql
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = @dbname 
  AND TABLE_NAME = 'scheduler_config' 
  AND COLUMN_NAME = 'cookie_refresh_logs';

PREPARE stmt FROM IFNULL(@sql, 'SELECT "Column cookie_refresh_logs does not exist"');
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- vehicle_monitor_config 表删除多余字段
-- token 字段重复，已有 ha_token
SET @sql = NULL;
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 
      CONCAT('ALTER TABLE `', @dbname, '`.`vehicle_monitor_config` DROP COLUMN `token`')
    ELSE NULL
  END INTO @sql
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = @dbname 
  AND TABLE_NAME = 'vehicle_monitor_config' 
  AND COLUMN_NAME = 'token';

PREPARE stmt FROM IFNULL(@sql, 'SELECT "Column token does not exist"');
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ==================== 3. 验证 ====================

-- 验证 scheduler_config 表结构
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'scheduler_config'
ORDER BY ORDINAL_POSITION;

-- 验证 vehicle_monitor_config 表结构
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'vehicle_monitor_config'
ORDER BY ORDINAL_POSITION;

-- 验证表是否已删除
SELECT 
  TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN (
    'daily_summaries', 
    'topic_material_usages', 
    'topic_sub_direction_usages', 
    'topic_sub_directions'
  );
