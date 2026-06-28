-- +migrate Up

-- 1. 修改 internet_reference_config 表的 platform 字段，支持多平台
ALTER TABLE internet_reference_config 
MODIFY COLUMN platform VARCHAR(500) DEFAULT 'xiaohongshu,douyin,weibo' COMMENT '多平台列表，逗号分隔';

-- 2. 创建互联网参考平台配置表
CREATE TABLE IF NOT EXISTS internet_reference_platforms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  platform_name VARCHAR(50) NOT NULL COMMENT '平台标识',
  display_name VARCHAR(100) NOT NULL COMMENT '平台显示名称',
  enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  priority INT DEFAULT 5 COMMENT '优先级（1-10，数字越大优先级越高）',
  weight DECIMAL(3,2) DEFAULT 1.00 COMMENT '权重（用于随机选择）',
  search_script VARCHAR(100) DEFAULT 'audi_search.js' COMMENT '搜索脚本名称',
  api_endpoint VARCHAR(500) COMMENT 'API 端点（可选）',
  rate_limit_per_hour INT DEFAULT 10 COMMENT '每小时频率限制',
  description VARCHAR(500) COMMENT '平台描述',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_platform_name (platform_name),
  INDEX idx_enabled_priority (enabled, priority DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='互联网参考平台配置表';

-- 3. 插入默认平台数据
INSERT INTO internet_reference_platforms 
  (platform_name, display_name, enabled, priority, weight, search_script, rate_limit_per_hour, description)
VALUES
  ('xiaohongshu', '小红书', 1, 10, 1.00, 'audi_search_xiaohongshu.js', 10, '高质量生活方式分享社区，适合用车生活、露营装备内容'),
  ('weibo', '微博', 1, 8, 0.80, 'audi_search_weibo.js', 15, '社交媒体平台，实时热点话题，适合汽车热点、品牌活动'),
  ('zhihu', '知乎', 1, 8, 0.80, 'audi_search_zhihu.js', 10, '专业问答社区，深度内容，适合用车知识、技术解析'),
  ('autohome', '汽车之家', 1, 7, 0.60, 'audi_search_autohome.js', 8, '专业汽车社区，垂直领域，适合车型对比、改装案例'),
  ('dongchedi', '懂车帝', 0, 7, 0.60, 'audi_search_dongchedi.js', 8, '汽车资讯社区，新车评测、用车心得'),
  ('mafengwo', '马蜂窝', 0, 6, 0.50, 'audi_search_mafengwo.js', 6, '旅游攻略社区，自驾路线、露营地点'),
  ('smzdm', '什么值得买', 0, 6, 0.50, 'audi_search_smzdm.js', 6, '购物分享社区，汽车用品、露营装备评测')
ON DUPLICATE KEY UPDATE 
  display_name = VALUES(display_name),
  enabled = VALUES(enabled),
  priority = VALUES(priority),
  weight = VALUES(weight),
  search_script = VALUES(search_script),
  rate_limit_per_hour = VALUES(rate_limit_per_hour),
  description = VALUES(description);

-- 4. 更新 internet_reference_config 的默认平台配置
UPDATE internet_reference_config 
SET platform = 'xiaohongshu,weibo,zhihu,autohome'
WHERE id = 1;

-- +migrate Down

-- 1. 恢复 platform 字段
ALTER TABLE internet_reference_config 
MODIFY COLUMN platform VARCHAR(50) DEFAULT 'xiaohongshu';

-- 2. 删除平台配置表
DROP TABLE IF EXISTS internet_reference_platforms;

-- 3. 恢复默认配置
UPDATE internet_reference_config 
SET platform = 'xiaohongshu'
WHERE id = 1;
