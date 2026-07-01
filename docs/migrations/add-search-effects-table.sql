-- 搜索效果记录表
-- 用于记录每次互联网搜索的详细信息，支持搜索词效果分析和平台质量评估

CREATE TABLE IF NOT EXISTS search_effects (
  id VARCHAR(100) PRIMARY KEY,
  platform VARCHAR(50) NOT NULL COMMENT '平台名称（xiaohongshu, weibo, zhihu, autohome）',
  keyword VARCHAR(500) NOT NULL COMMENT '搜索关键词',
  result_count INT NOT NULL DEFAULT 0 COMMENT '搜索结果数量',
  success TINYINT(1) NOT NULL DEFAULT 0 COMMENT '搜索是否成功',
  search_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '搜索时间',
  duration_ms INT COMMENT '搜索耗时（毫秒）',
  quality_score DECIMAL(5,2) COMMENT '质量评分（0-100）',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_platform (platform),
  INDEX idx_keyword (keyword),
  INDEX idx_search_time (search_time),
  INDEX idx_platform_keyword (platform, keyword),
  INDEX idx_platform_time (platform, search_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='搜索效果记录表';

-- 插入示例数据（可选）
-- INSERT INTO search_effects (id, platform, keyword, result_count, success)
-- VALUES 
--   ('sample_1', 'xiaohongshu', '奥迪 Q5L', 5, 1),
--   ('sample_2', 'xiaohongshu', '奥迪用车', 3, 1),
--   ('sample_3', 'zhihu', '奥迪 Q5L 评测', 8, 1);
