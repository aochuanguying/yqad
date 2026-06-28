-- 创建网络发帖配置表
-- 用于存储知乎、小红书、微博等平台的 API 配置

CREATE TABLE IF NOT EXISTS `network_post_config` (
  `id` INT PRIMARY KEY DEFAULT 1 COMMENT '配置 ID，固定为 1',
  
  -- 知乎配置
  `zhihu_access_secret` VARCHAR(255) DEFAULT '' COMMENT '知乎 Access Secret',
  `zhihu_enabled` TINYINT(1) DEFAULT 0 COMMENT '是否启用知乎搜索',
  
  -- 小红书配置
  `xiaohongshu_cookie` TEXT DEFAULT '' COMMENT '小红书 Cookie（包含 web_session 和 a1）',
  `xiaohongshu_enabled` TINYINT(1) DEFAULT 0 COMMENT '是否启用小红书搜索',
  
  -- 微博配置
  `weibo_access_token` VARCHAR(255) DEFAULT '' COMMENT '微博 Access Token',
  `weibo_enabled` TINYINT(1) DEFAULT 0 COMMENT '是否启用微博搜索',
  
  -- 通用配置
  `max_results` INT DEFAULT 10 COMMENT '默认返回结果数量',
  `enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用网络发帖功能',
  
  -- 时间戳
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='网络发帖配置表';

-- 初始化默认配置
INSERT INTO `network_post_config` (`id`, `enabled`) 
VALUES (1, 1)
ON DUPLICATE KEY UPDATE `id` = `id`;
