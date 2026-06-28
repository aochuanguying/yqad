-- 创建 embedding_config 表
CREATE TABLE IF NOT EXISTS `embedding_config` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `api_key` VARCHAR(500) NOT NULL COMMENT 'API Key',
  `base_url` VARCHAR(500) DEFAULT 'https://api.openai.com/v1' COMMENT 'API Base URL',
  `model` VARCHAR(100) DEFAULT 'text-embedding-3-small' COMMENT 'Embedding 模型',
  `dimension` INT DEFAULT 1536 COMMENT '向量维度',
  `enabled` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Embedding 向量配置表';

-- 从 ai_providers 表复制配置（使用 deepseek 的配置）
INSERT INTO `embedding_config` (`api_key`, `base_url`, `model`, `dimension`, `enabled`)
SELECT api_key, base_url, 'text-embedding-3-small', 1536, 1
FROM ai_providers 
WHERE name = 'deepseek' AND api_key IS NOT NULL
LIMIT 1
ON DUPLICATE KEY UPDATE
  `api_key` = VALUES(`api_key`),
  `base_url` = VALUES(`base_url`);
