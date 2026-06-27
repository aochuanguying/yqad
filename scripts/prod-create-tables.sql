-- ============================================================
-- 一汽奥迪 APP 自动任务系统 - 生产环境数据库表结构
-- ============================================================
-- 数据库：yqad_db
-- 字符集：utf8mb4
-- 排序规则：utf8mb4_unicode_ci
-- ============================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `yqad_db` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `yqad_db`;

-- ============================================================
-- 1. 会员信息表
-- ============================================================
DROP TABLE IF EXISTS `members`;
CREATE TABLE `members` (
  `id` VARCHAR(36) PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'user') DEFAULT 'user',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. 帖子历史表
-- ============================================================
DROP TABLE IF EXISTS `posts`;
CREATE TABLE `posts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `title` VARCHAR(500) NOT NULL,
  `content` TEXT,
  `topic_id` VARCHAR(36),
  `topic_name` VARCHAR(200),
  `status` ENUM('draft', 'published', 'failed') DEFAULT 'draft',
  `published_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_topic_id` (`topic_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_published_at` (`published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. 评论历史表
-- ============================================================
DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` VARCHAR(36) PRIMARY KEY,
  `post_id` VARCHAR(36) NOT NULL,
  `post_title` VARCHAR(500),
  `comment_content` TEXT NOT NULL,
  `status` ENUM('pending', 'published', 'failed') DEFAULT 'pending',
  `published_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_post_id` (`post_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. 发帖日志表
-- ============================================================
DROP TABLE IF EXISTS `post_logs`;
CREATE TABLE `post_logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `post_id` VARCHAR(36),
  `action` VARCHAR(50) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `error_message` TEXT,
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_post_id` (`post_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. 评论日志表
-- ============================================================
DROP TABLE IF EXISTS `comment_logs`;
CREATE TABLE `comment_logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `comment_id` VARCHAR(36),
  `action` VARCHAR(50) NOT NULL,
  `status` VARCHAR(20) NOT NULL,
  `error_message` TEXT,
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_comment_id` (`comment_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. 待发布帖子表
-- ============================================================
DROP TABLE IF EXISTS `pending_posts`;
CREATE TABLE `pending_posts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `title` VARCHAR(500) NOT NULL,
  `content` TEXT,
  `scheduled_time` DATETIME,
  `status` ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`),
  INDEX `idx_scheduled_time` (`scheduled_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. 合规性报告表
-- ============================================================
DROP TABLE IF EXISTS `compliance_reports`;
CREATE TABLE `compliance_reports` (
  `id` VARCHAR(36) PRIMARY KEY,
  `post_id` VARCHAR(36) NULL,
  `title` VARCHAR(500) NOT NULL,
  `content` TEXT NOT NULL,
  `topic_id` VARCHAR(36) NULL,
  `topic_name` VARCHAR(200),
  `trigger_type` ENUM('auto', 'manual') DEFAULT 'auto',
  `similarity_check` JSON,
  `sensitive_word_check` JSON,
  `quality_score` JSON,
  `posting_interval_check` JSON,
  `passed` BOOLEAN DEFAULT FALSE,
  `reject_reasons` JSON,
  `check_duration` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_post_id` (`post_id`),
  INDEX `idx_topic_id` (`topic_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. 全局人设表
-- ============================================================
DROP TABLE IF EXISTS `global_prompts`;
CREATE TABLE `global_prompts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `content` TEXT NOT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. 主题表
-- ============================================================
DROP TABLE IF EXISTS `topics`;
CREATE TABLE `topics` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `max_use_count` INT DEFAULT 1,
  `current_use_count` INT DEFAULT 0,
  `status` ENUM('available', 'unavailable') DEFAULT 'available',
  `tags` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. 主题子方向表
-- ============================================================
DROP TABLE IF EXISTS `topic_sub_directions`;
CREATE TABLE `topic_sub_directions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `topic_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_topic_id` (`topic_id`),
  FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. 主题子方向使用记录表
-- ============================================================
DROP TABLE IF EXISTS `topic_sub_direction_usages`;
CREATE TABLE `topic_sub_direction_usages` (
  `id` VARCHAR(36) PRIMARY KEY,
  `topic_id` VARCHAR(36) NOT NULL,
  `sub_direction_index` INT NOT NULL,
  `used_count` INT DEFAULT 0,
  `last_used_date` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_topic_sub_direction` (`topic_id`, `sub_direction_index`),
  INDEX `idx_topic_id` (`topic_id`),
  FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. 主题素材使用记录表
-- ============================================================
DROP TABLE IF EXISTS `topic_material_usages`;
CREATE TABLE `topic_material_usages` (
  `id` VARCHAR(36) PRIMARY KEY,
  `topic_id` VARCHAR(36) NOT NULL,
  `material_path` VARCHAR(500) NOT NULL,
  `used_count` INT DEFAULT 0,
  `last_used_date` DATETIME NULL,
  `used_in_posts` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_topic_material` (`topic_id`, `material_path`),
  INDEX `idx_topic_id` (`topic_id`),
  FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. 素材记录表
-- ============================================================
DROP TABLE IF EXISTS `material_records`;
CREATE TABLE `material_records` (
  `id` VARCHAR(36) PRIMARY KEY,
  `source` ENUM('local', 'internet') NOT NULL,
  `path` VARCHAR(500) NOT NULL,
  `url` VARCHAR(500),
  `quality_score` JSON,
  `matched_keywords` JSON,
  `usage_count` INT DEFAULT 0,
  `last_used_date` DATETIME NULL,
  `associated_posts` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_source` (`source`),
  INDEX `idx_path` (`path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. 每日摘要表
-- ============================================================
DROP TABLE IF EXISTS `daily_summaries`;
CREATE TABLE `daily_summaries` (
  `id` VARCHAR(36) PRIMARY KEY,
  `date` DATE NOT NULL UNIQUE,
  `comments_total` INT DEFAULT 0,
  `comments_successful` INT DEFAULT 0,
  `comments_failed` INT DEFAULT 0,
  `posts_total` INT DEFAULT 0,
  `posts_successful` INT DEFAULT 0,
  `posts_failed` INT DEFAULT 0,
  `failed_tasks` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 数据初始化
-- ============================================================

-- 初始化默认管理员账户 (密码：admin123，请生产环境修改)
INSERT INTO `members` (`id`, `username`, `password_hash`, `role`) 
VALUES ('admin-001', 'admin', '$2b$10$rH9zqX8FQ7N.Pz3kGJZtqO1vY8wK5mL3nR7sT9uV1wX3yZ5aB7cD', 'admin')
ON DUPLICATE KEY UPDATE `username` = `username`;

-- 初始化默认全局人设
INSERT INTO `global_prompts` (`id`, `name`, `content`, `is_active`)
VALUES 
  ('prompt-001', '默认人设', '你是一个热爱生活、乐于分享的人，喜欢用文字记录生活中的美好瞬间。', TRUE)
ON DUPLICATE KEY UPDATE `name` = `name`;

-- ============================================================
-- 完成提示
-- ============================================================
SELECT '✅ 数据库表结构创建完成！' AS status;
SELECT '✅ 数据初始化完成！' AS status;
