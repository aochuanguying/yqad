-- 创建内容质量评分配置表
CREATE TABLE IF NOT EXISTS content_quality_scoring_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  min_score INT DEFAULT 60,
  weight_completeness DECIMAL(3,2) DEFAULT 0.30,
  weight_originality DECIMAL(3,2) DEFAULT 0.30,
  weight_diversity DECIMAL(3,2) DEFAULT 0.20,
  weight_attractiveness DECIMAL(3,2) DEFAULT 0.20,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认内容质量评分配置（如果不存在）
INSERT INTO content_quality_scoring_config (
  enabled, min_score, weight_completeness, weight_originality, weight_diversity, weight_attractiveness
)
SELECT 1, 60, 0.30, 0.30, 0.20, 0.20
WHERE NOT EXISTS (SELECT 1 FROM content_quality_scoring_config);
