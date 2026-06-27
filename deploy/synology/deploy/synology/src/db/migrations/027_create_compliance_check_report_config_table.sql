-- 合规性检查报告配置表
-- 存储合规性检查报告的配置信息
CREATE TABLE IF NOT EXISTS compliance_check_report_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  storage_path VARCHAR(500) DEFAULT './data/compliance-reports',
  retain_days INT DEFAULT 30,
  timeout INT DEFAULT 5000,
  post_script VARCHAR(100) DEFAULT 'audi_post.js',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认配置
INSERT INTO compliance_check_report_config (enabled, storage_path, retain_days, timeout, post_script)
VALUES (1, './data/compliance-reports', 30, 5000, 'audi_post.js')
ON DUPLICATE KEY UPDATE
  storage_path = VALUES(storage_path),
  retain_days = VALUES(retain_days),
  timeout = VALUES(timeout),
  post_script = VALUES(post_script);
