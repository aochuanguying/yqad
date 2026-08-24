-- Cookie 配置池表
-- 用于 social-search 服务管理多套知乎/小红书 Cookie 和 Access Secret

CREATE TABLE IF NOT EXISTS `cookie_configs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `platform` VARCHAR(50) NOT NULL COMMENT '平台：zhihu / xiaohongshu',
  `label` VARCHAR(100) DEFAULT '' COMMENT '配置名称，如"账号A"、"主号"',
  `cookie` TEXT COMMENT 'Cookie 字符串',
  `access_secret` VARCHAR(255) DEFAULT '' COMMENT '知乎 Access Secret（知乎专用）',
  `enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `priority` INT DEFAULT 0 COMMENT '优先级（越高越优先）',
  `weight` INT DEFAULT 10 COMMENT '权重（负载均衡，0-100）',
  `use_count` INT DEFAULT 0 COMMENT '累计使用次数',
  `last_used_at` DATETIME DEFAULT NULL COMMENT '最后使用时间',
  `cookie_version` INT DEFAULT 0 COMMENT 'Cookie 版本号',
  `last_refresh_at` DATETIME DEFAULT NULL COMMENT '最后刷新时间',
  `next_refresh_at` DATETIME DEFAULT NULL COMMENT '下次刷新时间',
  `refresh_logs` JSON DEFAULT NULL COMMENT '最近 30 条刷新记录',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_platform` (`platform`),
  INDEX `idx_platform_enabled` (`platform`, `enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Cookie 配置池';
