-- 创建敏感词过滤配置表
CREATE TABLE IF NOT EXISTS sensitive_word_filter_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  word_library_path VARCHAR(500) DEFAULT './data/sensitive-words.json',
  enable_replacement TINYINT(1) DEFAULT 1,
  auto_reject_on_forbidden TINYINT(1) DEFAULT 1,
  warning_threshold INT DEFAULT 3,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认敏感词过滤配置（如果不存在）
INSERT INTO sensitive_word_filter_config (
  enabled, word_library_path, enable_replacement, auto_reject_on_forbidden, warning_threshold
)
SELECT 1, './data/sensitive-words.json', 1, 1, 3
WHERE NOT EXISTS (SELECT 1 FROM sensitive_word_filter_config);
