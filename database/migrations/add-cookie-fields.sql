-- ============================================================
-- Cookie 自动刷新功能数据库迁移脚本（简化版）
-- 创建日期：2026-06-29
-- 说明：在现有 network_post_config 表上添加辅助字段
-- ============================================================

-- 添加 Cookie 相关辅助字段
ALTER TABLE `network_post_config` 
ADD COLUMN IF NOT EXISTS `cookie_version` INT DEFAULT 0 COMMENT 'Cookie 版本号' AFTER `xiaohongshu_cookie`,
ADD COLUMN IF NOT EXISTS `last_refresh_time` DATETIME DEFAULT NULL COMMENT '最后刷新时间' AFTER `cookie_version`,
ADD COLUMN IF NOT EXISTS `next_refresh_time` DATETIME DEFAULT NULL COMMENT '下次刷新时间' AFTER `last_refresh_time`,
ADD COLUMN IF NOT EXISTS `cookie_refresh_logs` JSON DEFAULT NULL COMMENT '最近 30 次刷新记录（JSON）' AFTER `next_refresh_time`;

-- 验证字段是否添加成功
SELECT 
  COLUMN_NAME, 
  DATA_TYPE, 
  CHARACTER_MAXIMUM_LENGTH,
  COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'network_post_config' 
  AND COLUMN_NAME IN ('cookie_version', 'last_refresh_time', 'next_refresh_time', 'cookie_refresh_logs');

-- 显示当前表结构
DESC network_post_config;
