-- =====================================================
-- 数据库迁移脚本：001_add_platform_support.sql
-- 描述：为互联网参考功能添加多平台支持
-- 版本：v1.0
-- 日期：2026-06-28
-- =====================================================

-- 开始事务
START TRANSACTION;

-- =====================================================
-- 任务 1.1: 为 internet_reference_config 表添加 platform 字段
-- =====================================================

-- 检查字段是否已存在，避免重复执行报错
SET @table_name = 'internet_reference_config';
SET @column_name = 'platform';

SELECT COUNT(*) INTO @column_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = @table_name
  AND COLUMN_NAME = @column_name;

-- 如果字段不存在，则添加
SET @sql = IF(@column_exists = 0,
  'ALTER TABLE internet_reference_config 
   ADD COLUMN platform VARCHAR(20) NOT NULL DEFAULT ''all'' 
   COMMENT ''平台：xiaohongshu|zhihu|autohome|all'' 
   AFTER rate_limit_per_hour',
  'SELECT ''Column platform already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 修改 search_keywords 字段类型，支持更长的搜索词列表
ALTER TABLE internet_reference_config 
MODIFY COLUMN search_keywords TEXT 
COMMENT '搜索词列表，逗号分隔';

-- =====================================================
-- 任务 1.2: 为 internet_reference_platforms 表添加新字段
-- =====================================================

-- 检查表是否存在
SET @table_exists = 0;
SELECT COUNT(*) INTO @table_exists
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'internet_reference_platforms';

-- 如果表存在，添加新字段
SET @sql = IF(@table_exists > 0,
  'ALTER TABLE internet_reference_platforms
   ADD COLUMN IF NOT EXISTS priority INT DEFAULT 5 
   COMMENT ''优先级 1-10'' 
   AFTER platform_name,
   ADD COLUMN IF NOT EXISTS rate_limit_per_hour INT DEFAULT 50 
   COMMENT ''每小时频率限制'' 
   AFTER priority,
   ADD COLUMN IF NOT EXISTS success_rate DECIMAL(5,2) DEFAULT 100.00 
   COMMENT ''历史成功率（%）'' 
   AFTER rate_limit_per_hour',
  'SELECT ''Table internet_reference_platforms does not exist'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- 任务 1.3 & 1.4: 初始化三个平台的配置数据
-- =====================================================

-- 插入小红书平台配置
INSERT INTO internet_reference_config (
  enabled, search_keywords, max_results, timeout, rate_limit_per_hour, platform,
  watermark_removal_enabled, watermark_removal_timeout, watermark_removal_max_retries, watermark_removal_batch_size
) VALUES (
  1, 
  '奥迪 Q5L，奥迪 A4L，奥迪上下班，奥迪自驾游，奥迪真香，奥迪油耗，奥迪空间，Q5L vs X3，奥迪接送孩子，奥迪露营',
  5, 90000, 20, 'xiaohongshu',
  1, 30000, 2, 5
) ON DUPLICATE KEY UPDATE
  search_keywords = VALUES(search_keywords),
  rate_limit_per_hour = VALUES(rate_limit_per_hour);

-- 插入知乎平台配置
INSERT INTO internet_reference_config (
  enabled, search_keywords, max_results, timeout, rate_limit_per_hour, platform,
  watermark_removal_enabled, watermark_removal_timeout, watermark_removal_max_retries, watermark_removal_batch_size
) VALUES (
  1, 
  '如何评价奥迪 Q5L，奥迪 Q5L 值得购买吗，奥迪 Q5L vs 宝马 X3，奥迪 Q5L 油耗实测，30 万豪华 SUV 推荐，奥迪 Q5L 保养成本，奥迪 Q5L 驾驶感受',
  5, 90000, 100, 'zhihu',
  1, 30000, 2, 5
) ON DUPLICATE KEY UPDATE
  search_keywords = VALUES(search_keywords),
  rate_limit_per_hour = VALUES(rate_limit_per_hour);

-- 插入汽车之家平台配置
INSERT INTO internet_reference_config (
  enabled, search_keywords, max_results, timeout, rate_limit_per_hour, platform,
  watermark_removal_enabled, watermark_removal_timeout, watermark_removal_max_retries, watermark_removal_batch_size
) VALUES (
  1, 
  '提车，油耗，改装，异响，保养，Q5L,A4L,A6L，作业，实测，奥迪 Q5L 提车作业，奥迪 Q5L 落地价',
  5, 90000, 50, 'autohome',
  1, 30000, 2, 5
) ON DUPLICATE KEY UPDATE
  search_keywords = VALUES(search_keywords),
  rate_limit_per_hour = VALUES(rate_limit_per_hour);

-- 更新现有通用配置（platform='all'）
UPDATE internet_reference_config 
SET search_keywords = '奥迪，奥迪 Q5L，奥迪用车，自驾游，露营',
    platform = 'all',
    rate_limit_per_hour = 10
WHERE platform = 'all' OR platform IS NULL;

-- 如果 internet_reference_platforms 表不存在，创建并初始化
CREATE TABLE IF NOT EXISTS internet_reference_platforms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  platform_name VARCHAR(50) NOT NULL UNIQUE COMMENT '平台名称：xiaohongshu|zhihu|autohome',
  platform_display VARCHAR(50) NOT NULL COMMENT '平台显示名称',
  priority INT DEFAULT 5 COMMENT '优先级 1-10',
  rate_limit_per_hour INT DEFAULT 50 COMMENT '每小时频率限制',
  success_rate DECIMAL(5,2) DEFAULT 100.00 COMMENT '历史成功率（%）',
  enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_platform_name (platform_name),
  INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT '互联网参考平台配置表';

-- 初始化平台配置数据（任务 1.4）
INSERT INTO internet_reference_platforms (platform_name, platform_display, priority, rate_limit_per_hour, enabled) VALUES
  ('xiaohongshu', '小红书', 8, 20, 1),
  ('zhihu', '知乎', 7, 100, 1),
  ('autohome', '汽车之家', 8, 50, 1)
ON DUPLICATE KEY UPDATE
  priority = VALUES(priority),
  rate_limit_per_hour = VALUES(rate_limit_per_hour);

-- 提交事务
COMMIT;

-- =====================================================
-- 迁移完成
-- =====================================================
SELECT '✅ 数据库迁移 001_add_platform_support 执行成功' AS message;
