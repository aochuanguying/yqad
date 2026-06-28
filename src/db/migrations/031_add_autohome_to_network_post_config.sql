-- 为 network_post_config 表添加汽车之家配置字段

ALTER TABLE `network_post_config`
  ADD COLUMN `autohome_cookie` TEXT DEFAULT '' COMMENT '汽车之家 Cookie（登录后获取）' AFTER `weibo_enabled`,
  ADD COLUMN `autohome_enabled` TINYINT(1) DEFAULT 0 COMMENT '是否启用汽车之家搜索' AFTER `autohome_cookie`;
