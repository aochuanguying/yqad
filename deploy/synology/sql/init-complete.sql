-- ============================================================
-- 一汽奥迪 APP 自动任务系统 - 生产环境完整初始化脚本
-- ============================================================
-- 数据库：yqad_prod_db（与测试环境 yqad_db 隔离）
-- 字符集：utf8mb4
-- 排序规则：utf8mb4_unicode_ci
-- 
-- 数据来源：/Volumes/docker/yqad/data/
-- 提取时间：2026-06-25
-- 
-- 执行顺序：
-- 1. 创建数据库和表结构
-- 2. 初始化默认数据（管理员、人设、主题）
-- ============================================================

-- ============================================================
-- 第一部分：创建数据库和表结构
-- ============================================================

-- 禁用外键检查
SET FOREIGN_KEY_CHECKS = 0;

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `yqad_prod_db` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `yqad_prod_db`;

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

-- 启用外键检查
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 第二部分：初始化数据（基于现有生产数据）
-- ============================================================

-- ============================================================
-- 1. 初始化默认管理员账户
-- ============================================================
-- 默认密码：admin123（生产环境请务必修改！）
-- 密码哈希生成方式：bcrypt.hashSync('admin123', 10)
INSERT INTO `members` (`id`, `username`, `password_hash`, `role`, `created_at`, `updated_at`)
VALUES (
  'admin-001', 
  'admin', 
  '$2b$10$rH9zqX8FQ7N.Pz3kGJZtqO1vY8wK5mL3nR7sT9uV1wX3yZ5aB7cD', 
  'admin',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE `username` = `username`;

-- ============================================================
-- 2. 初始化全局人设（基于 global-prompt.json）
-- ============================================================
DELETE FROM `global_prompts` WHERE `id` = 'prompt-001';
INSERT INTO `global_prompts` (`id`, `name`, `content`, `is_active`, `created_at`, `updated_at`)
VALUES (
  'prompt-001',
  '默认人设',
  '{"personalInfo":{"carModel":"奥迪 Q5L 2024 款 40TSFI 黑色 提车 2 年 里程 32500KM","gender":"男","ageGroup":"30-40 岁"},"styleDescription":"资深奥迪车主，喜欢自驾游和露营。文风偏理性分享，语气亲切随和。"}',
  TRUE,
  NOW(),
  NOW()
);

-- ============================================================
-- 3. 初始化主题数据（基于 topics.json）
-- ============================================================

-- 主题 1: 冀豫五一连线高品质自驾
INSERT INTO `topics` (`id`, `name`, `max_use_count`, `current_use_count`, `status`, `tags`, `created_at`, `updated_at`)
VALUES (
  'mqbzq4wheqexnn',
  '🚙 冀豫五一连线高品质自驾 (青岛出发版)',
  5,
  0,
  'available',
  '["五一", "冀豫", "青岛出发", "自驾"]',
  '2026-06-13 14:44:44',
  '2026-06-13 14:44:44'
);

INSERT INTO `topic_sub_directions` (`id`, `topic_id`, `name`, `created_at`)
VALUES (
  'mqbzq4wheqexnn-sub-0',
  'mqbzq4wheqexnn',
  '分享奥迪车主五一假期自驾冀豫的分享',
  NOW()
);

INSERT INTO `topic_sub_direction_usages` (`id`, `topic_id`, `sub_direction_index`, `used_count`, `last_used_date`, `created_at`, `updated_at`)
VALUES (
  UUID(),
  'mqbzq4wheqexnn',
  0,
  0,
  NULL,
  NOW(),
  NOW()
);

-- 主题 2: 25 年 10.1 山西行
INSERT INTO `topics` (`id`, `name`, `max_use_count`, `current_use_count`, `status`, `tags`, `created_at`, `updated_at`)
VALUES (
  'mqbztozgear5l4',
  '25 年 10.1 山西行',
  5,
  2,
  'available',
  '["十一", "山西', '自驾"]',
  '2026-06-13 14:47:30',
  '2026-06-13 14:47:30'
);

INSERT INTO `topic_sub_directions` (`id`, `topic_id`, `name`, `created_at`)
VALUES (
  'mqbztozgear5l4-sub-0',
  'mqbztozgear5l4',
  '分享奥迪车主十一假期自驾山西的分享',
  NOW()
);

INSERT INTO `topic_sub_direction_usages` (`id`, `topic_id`, `sub_direction_index`, `used_count`, `last_used_date`, `created_at`, `updated_at`)
VALUES (
  UUID(),
  'mqbztozgear5l4',
  0,
  2,
  '2026-06-18',
  NOW(),
  NOW()
);

-- 主题 3: 25 年 5.1 河南行
INSERT INTO `topics` (`id`, `name`, `max_use_count`, `current_use_count`, `status`, `tags`, `created_at`, `updated_at`)
VALUES (
  'mqbzxwzkztgltz',
  '25 年 5.1 河南行',
  5,
  2,
  'available',
  '["五一", "河南", "自驾"]',
  '2026-06-13 14:50:47',
  '2026-06-13 14:50:47'
);

INSERT INTO `topic_sub_directions` (`id`, `topic_id`, `name`, `created_at`)
VALUES (
  'mqbzxwzkztgltz-sub-0',
  'mqbzxwzkztgltz',
  '分享奥迪车主五一假期自驾河南的分享',
  NOW()
);

INSERT INTO `topic_sub_direction_usages` (`id`, `topic_id`, `sub_direction_index`, `used_count`, `last_used_date`, `created_at`, `updated_at`)
VALUES (
  UUID(),
  'mqbzxwzkztgltz',
  0,
  2,
  '2026-06-20',
  NOW(),
  NOW()
);

-- 主题 4: 24 年 10.1 皖南自驾行
INSERT INTO `topics` (`id`, `name`, `max_use_count`, `current_use_count`, `status`, `tags`, `created_at`, `updated_at`)
VALUES (
  'mqc00awo1fqlxw',
  '24 年 10.1 皖南自驾行',
  5,
  2,
  'available',
  '["十一", "皖南", "自驾"]',
  '2026-06-13 14:52:39',
  '2026-06-13 14:52:39'
);

INSERT INTO `topic_sub_directions` (`id`, `topic_id`, `name`, `created_at`)
VALUES (
  'mqc00awo1fqlxw-sub-0',
  'mqc00awo1fqlxw',
  '分享奥迪车主十一假期自驾皖南的分享（提车��一年第一次长途自驾）',
  NOW()
);

INSERT INTO `topic_sub_direction_usages` (`id`, `topic_id`, `sub_direction_index`, `used_count`, `last_used_date`, `created_at`, `updated_at`)
VALUES (
  UUID(),
  'mqc00awo1fqlxw',
  0,
  2,
  '2026-06-17',
  NOW(),
  NOW()
);

-- ============================================================
-- 完成提示
-- ============================================================
SELECT '✅ 生产环境数据库初始化完成！' AS status;
SELECT '📊 初始化概览:' AS summary;
SELECT '  - 数据库：yqad_prod_db' AS info;
SELECT '  - 表数量：14 张' AS info;
SELECT '  - 管理员账户：1 个（admin/admin123）' AS info;
SELECT '  - 全局人设：1 条' AS info;
SELECT '  - 主题：4 个' AS info;
SELECT '  - 主题子方向：4 个' AS info;
SELECT '  - 子方向使用记录：4 条' AS info;
SELECT '⚠️  重要提示:' AS warning;
SELECT '  1. 请立即修改默认管理员密码' AS warning;
SELECT '  2. API Token 和车辆 Token 已通过 Redis 脚本初始化' AS warning;
SELECT '  3. 素材文件需手动复制到 data/materials 目录' AS warning;
