-- 为网络发帖配置表添加知乎 Cookie 字段
-- 用于存储知乎 Cookie（配合 Playwright 提取正文和图片）

ALTER TABLE `network_post_config`
ADD COLUMN `zhihu_cookie` TEXT COMMENT '知乎 Cookie（用于 Playwright 访问公开页面）'
AFTER `zhihu_enabled`;

-- 更新注释说明
ALTER TABLE `network_post_config` 
MODIFY COLUMN `zhihu_access_secret` VARCHAR(255) DEFAULT '' COMMENT '知乎 Access Secret（用于官方 API）';

-- 初始化已有记录的 zhihu_cookie 字段为空字符串
UPDATE `network_post_config` SET `zhihu_cookie` = '' WHERE `zhihu_cookie` IS NULL;
