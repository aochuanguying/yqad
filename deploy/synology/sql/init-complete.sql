-- ============================================================
-- 一汽奥迪 APP 自动任务系统 - 生产环境完整初始化脚本
-- ============================================================
-- 数据库：yqad_prod_db（与测试环境 yqad_db 隔离）
-- 字符集：utf8mb4
-- 排序规则：utf8mb4_unicode_ci
-- 
-- 数据来源：/Volumes/docker/yqad/data/
-- 提取时间：2026-06-27
-- 
-- ⚠️ 警告：
-- 1. 此脚本仅在首次部署或灾难恢复时执行！
-- 2. 日常发版严禁执行！否则会清空所有业务数据！
-- 3. 此脚本不会自动执行，必须手工运行！
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
  `id` VARCHAR(64) PRIMARY KEY,
  `username` VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
  `email` VARCHAR(100) UNIQUE COMMENT '邮箱',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希',
  `member_level` ENUM('free', 'basic', 'premium', 'vip') DEFAULT 'free' COMMENT '会员等级',
  `expires_at` DATETIME COMMENT '会员过期时间',
  `post_count` INT DEFAULT 0 COMMENT '发帖数量',
  `comment_count` INT DEFAULT 0 COMMENT '评论数量',
  `last_login_at` DATETIME COMMENT '最后登录时间',
  `last_login_ip` VARCHAR(45) COMMENT '最后登录 IP',
  `status` ENUM('active', 'disabled', 'deleted') DEFAULT 'active' COMMENT '账号状态',
  `deleted_at` DATETIME COMMENT '删除时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_username` (`username`),
  INDEX `idx_email` (`email`),
  INDEX `idx_member_level` (`member_level`),
  INDEX `idx_expires_at` (`expires_at`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员表';

-- ============================================================
-- 2. 帖子表
-- ============================================================
DROP TABLE IF EXISTS `posts`;
CREATE TABLE `posts` (
  `id` VARCHAR(64) PRIMARY KEY,
  `member_id` VARCHAR(64) NOT NULL COMMENT '作者 ID',
  `title` VARCHAR(200) NOT NULL COMMENT '标题',
  `content` TEXT COMMENT '内容',
  `summary` TEXT COMMENT '摘要',
  `cover_image_url` VARCHAR(500) COMMENT '封面图片 URL',
  `status` ENUM('draft', 'published', 'deleted') DEFAULT 'draft' COMMENT '状态',
  `view_count` INT DEFAULT 0 COMMENT '浏览数',
  `like_count` INT DEFAULT 0 COMMENT '点赞数',
  `comment_count` INT DEFAULT 0 COMMENT '评论数',
  `published_at` DATETIME COMMENT '发布时间',
  `scheduled_at` DATETIME COMMENT '定时发布时间',
  `featured` BOOLEAN DEFAULT FALSE COMMENT '是否精选',
  `deleted_at` DATETIME COMMENT '删除时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
  INDEX `idx_member_id` (`member_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_published_at` (`published_at`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_featured` (`featured`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帖子表';

-- ============================================================
-- 3. 评论表
-- ============================================================
DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` VARCHAR(64) PRIMARY KEY,
  `post_id` VARCHAR(64) NOT NULL COMMENT '帖子 ID',
  `member_id` VARCHAR(64) NOT NULL COMMENT '评论者 ID',
  `parent_id` VARCHAR(64) COMMENT '父评论 ID（用于回复）',
  `content` TEXT NOT NULL COMMENT '评论内容',
  `status` ENUM('pending', 'approved', 'rejected', 'deleted') DEFAULT 'approved' COMMENT '状态',
  `ip_address` VARCHAR(45) COMMENT '评论 IP',
  `user_agent` VARCHAR(500) COMMENT '用户代理',
  `approved_at` DATETIME COMMENT '审核通过时间',
  `approved_by` VARCHAR(64) COMMENT '审核者 ID',
  `rejected_at` DATETIME COMMENT '审核拒绝时间',
  `rejected_by` VARCHAR(64) COMMENT '拒绝者 ID',
  `deleted_at` DATETIME COMMENT '删除时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `edited_at` DATETIME COMMENT '编辑时间',
  FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE,
  INDEX `idx_post_id` (`post_id`),
  INDEX `idx_member_id` (`member_id`),
  INDEX `idx_parent_id` (`parent_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论表';

-- ============================================================
-- 4. 发帖日志表
-- ============================================================
DROP TABLE IF EXISTS `post_logs`;
CREATE TABLE `post_logs` (
  `id` VARCHAR(64) PRIMARY KEY,
  `post_id` VARCHAR(64) COMMENT '帖子 ID',
  `title` VARCHAR(200) NOT NULL COMMENT '帖子标题',
  `topic_id` VARCHAR(64) COMMENT '主题 ID',
  `topic_name` VARCHAR(100) COMMENT '主题名称',
  `content` TEXT COMMENT '帖子内容',
  `image_urls` JSON COMMENT '图片 URL 列表',
  `status` ENUM('success', 'failed', 'pending') NOT NULL COMMENT '发帖状态',
  `error_message` TEXT COMMENT '错误信息',
  `mode` ENUM('normal', 'featured') NOT NULL COMMENT '发帖模式',
  `trigger_type` ENUM('auto', 'manual') NOT NULL COMMENT '触发类型',
  `compliance_report_id` VARCHAR(64) COMMENT '合规检查报告 ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_post_id` (`post_id`),
  INDEX `idx_topic_id` (`topic_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_mode` (`mode`),
  INDEX `idx_trigger_type` (`trigger_type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='发帖日志表';

-- ============================================================
-- 5. 评论日志表
-- ============================================================
DROP TABLE IF EXISTS `comment_logs`;
CREATE TABLE `comment_logs` (
  `id` VARCHAR(64) PRIMARY KEY,
  `post_id` VARCHAR(64) NOT NULL COMMENT '帖子 ID',
  `post_title` VARCHAR(200) COMMENT '帖子标题',
  `post_content` TEXT COMMENT '帖子内容摘要',
  `content_type` VARCHAR(50) COMMENT '帖子类型',
  `comment_content` TEXT NOT NULL COMMENT '评论内容',
  `comment_id` VARCHAR(64) COMMENT '评论 ID',
  `success` BOOLEAN NOT NULL COMMENT '是否成功',
  `error` TEXT COMMENT '错误信息',
  `mode` ENUM('normal', 'fallback') NOT NULL COMMENT '评论模式',
  `source` ENUM('auto', 'manual') NOT NULL COMMENT '执行来源',
  `publish_time` DATETIME COMMENT '帖子发布时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时��',
  INDEX `idx_post_id` (`post_id`),
  INDEX `idx_comment_id` (`comment_id`),
  INDEX `idx_success` (`success`),
  INDEX `idx_mode` (`mode`),
  INDEX `idx_source` (`source`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论日志表';

-- ============================================================
-- 6. 待确认发帖表
-- ============================================================
DROP TABLE IF EXISTS `pending_posts`;
CREATE TABLE `pending_posts` (
  `id` VARCHAR(64) PRIMARY KEY,
  `task_id` VARCHAR(64) UNIQUE NOT NULL COMMENT '任务 ID',
  `member_id` VARCHAR(64) COMMENT '会员 ID',
  `title` VARCHAR(200) NOT NULL COMMENT '帖子标题',
  `content` TEXT COMMENT '帖子内容',
  `summary` VARCHAR(500) COMMENT '摘要',
  `cover_image_url` VARCHAR(500) COMMENT '封面图',
  `image_urls` JSON COMMENT '图片 URL 列表',
  `topic_id` VARCHAR(64) COMMENT '主题 ID',
  `topic_name` VARCHAR(100) COMMENT '主题名称',
  `mode` ENUM('normal', 'featured') NOT NULL COMMENT '发帖模式',
  `status` ENUM('pending', 'confirmed', 'rejected', 'expired') NOT NULL DEFAULT 'pending' COMMENT '状态',
  `expires_at` DATETIME NOT NULL COMMENT '过期时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `confirmed_at` DATETIME COMMENT '确认时间',
  INDEX `idx_task_id` (`task_id`),
  INDEX `idx_member_id` (`member_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='待确认发帖表';

-- ============================================================
-- 7. 合规性检查报告表
-- ============================================================
DROP TABLE IF EXISTS `compliance_reports`;
CREATE TABLE `compliance_reports` (
  `id` VARCHAR(64) PRIMARY KEY,
  `post_id` VARCHAR(64) COMMENT '帖子 ID',
  `title` VARCHAR(200) NOT NULL COMMENT '帖子标题',
  `content` TEXT NOT NULL COMMENT '帖子内容',
  `topic_id` VARCHAR(64) COMMENT '主题 ID',
  `topic_name` VARCHAR(100) COMMENT '主题名称',
  `trigger_type` ENUM('auto', 'manual') NOT NULL COMMENT '触发类型',
  `similarity_check` JSON COMMENT '相似度检查结果',
  `sensitive_word_check` JSON COMMENT '敏感词检查结果',
  `quality_score` JSON COMMENT '质量评分',
  `posting_interval_check` JSON COMMENT '发帖间隔检查',
  `passed` BOOLEAN NOT NULL COMMENT '是否通过',
  `reject_reasons` JSON COMMENT '拒绝原因列表',
  `check_duration` INT NOT NULL COMMENT '检查耗时 (毫秒)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_post_id` (`post_id`),
  INDEX `idx_topic_id` (`topic_id`),
  INDEX `idx_passed` (`passed`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='合规性检查报告表';

-- ============================================================
-- 8. 全局人设表
-- ============================================================
DROP TABLE IF EXISTS `global_prompts`;
CREATE TABLE `global_prompts` (
  `id` INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键 ID',
  `personal_info` JSON NOT NULL COMMENT '个人信息（车型、性别、年龄段等）',
  `style_description` TEXT COMMENT '内容风格描述',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全局人设配置表';

-- ============================================================
-- 9. 主题表
-- ============================================================
DROP TABLE IF EXISTS `topics`;
CREATE TABLE `topics` (
  `id` VARCHAR(64) PRIMARY KEY,
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
  `id` VARCHAR(64) PRIMARY KEY,
  `topic_id` VARCHAR(64) NOT NULL,
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
  `id` VARCHAR(64) PRIMARY KEY,
  `topic_id` VARCHAR(64) NOT NULL,
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
  `id` VARCHAR(64) PRIMARY KEY,
  `topic_id` VARCHAR(64) NOT NULL,
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
  `id` VARCHAR(64) PRIMARY KEY,
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
  `id` VARCHAR(64) PRIMARY KEY,
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
-- 第二部分：初始化数据
-- ============================================================

-- ============================================================
-- 1. 初始化默认管理员账户
-- ============================================================
-- 用户名：wangfuwei
-- 密码：Wfw7539148@
-- 会员等级：vip
-- 密码哈希生成方式：bcrypt.hashSync('Wfw7539148@', 10)
INSERT INTO `members` (`id`, `username`, `password_hash`, `member_level`, `status`, `created_at`, `updated_at`)
VALUES (
  'admin-001', 
  'wangfuwei', 
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'vip',
  'active',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE `username` = `username`;

-- ============================================================
-- 2. 初始化全局人设（基于 global-prompt.json）
-- ============================================================
INSERT INTO `global_prompts` (`personal_info`, `style_description`, `created_at`, `updated_at`)
VALUES (
  '{"carModel":"奥迪 Q5L 2024 款 40TSFI 黑色 提车 2 年 里程 32500KM","gender":"男","ageGroup":"30-40 岁"}',
  '资深奥迪车主，喜欢自驾游和露营。文风偏理性分享，语气亲切随和。',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE `personal_info` = VALUES(`personal_info`);

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
  '["十一", "山西", "自驾"]',
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
  '分享奥迪车主十一假期自驾皖南的分享（提车后一年第一次长途自驾）',
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
SELECT '  - 管理员账户：1 个（wangfuwei/Wfw7539148@）' AS info;
SELECT '  - 全局人设：1 条' AS info;
SELECT '  - 主题：4 个' AS info;
SELECT '  - 主题子方向：4 个' AS info;
SELECT '  - 子方向使用记录：4 条' AS info;
SELECT '⚠️  重要提示:' AS warning;
SELECT '  1. API Token 和车辆 Token 已通过 Redis 脚本初始化' AS warning;
SELECT '  2. 素材文件需手动复制到 data/materials 目录' AS warning;
