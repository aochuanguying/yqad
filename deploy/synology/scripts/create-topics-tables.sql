-- 创建 topics 表
CREATE TABLE IF NOT EXISTS topics (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT '主题名称',
  max_use_count INT DEFAULT 1 COMMENT '最大使用次数',
  current_use_count INT DEFAULT 0 COMMENT '当前使用次数',
  status ENUM('available', 'unavailable') DEFAULT 'available' COMMENT '状态',
  tags JSON COMMENT '标签数组',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='主题表';

-- 创建 topic_sub_directions 表
CREATE TABLE IF NOT EXISTS topic_sub_directions (
  id VARCHAR(50) PRIMARY KEY,
  topic_id VARCHAR(50) NOT NULL COMMENT '主题 ID',
  name VARCHAR(255) NOT NULL COMMENT '子方向名称',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  INDEX idx_topic_id (topic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='主题子方向表';

-- 创建 material_records 表
CREATE TABLE IF NOT EXISTS material_records (
  id VARCHAR(100) PRIMARY KEY COMMENT '文件路径哈希或 UUID',
  original_path VARCHAR(500) NOT NULL COMMENT '原始文件路径',
  processed_path VARCHAR(500) NOT NULL COMMENT '处理后文件路径',
  original_hash VARCHAR(64) COMMENT '原始文件哈希',
  processed_hash VARCHAR(64) COMMENT '处理后文件哈希',
  file_size INT COMMENT '文件大小 (字节)',
  width INT COMMENT '图片宽度',
  height INT COMMENT '图片高度',
  format VARCHAR(20) COMMENT '图片格式',
  is_watermark BOOLEAN DEFAULT FALSE COMMENT '是否有水印',
  ocr_text TEXT COMMENT 'OCR 识别文本',
  description TEXT COMMENT '图片描述',
  tags JSON COMMENT '标签数组',
  source_type ENUM('local', 'internet') DEFAULT 'local' COMMENT '来源类型',
  internet_url VARCHAR(500) COMMENT '网络图片 URL',
  used_count INT DEFAULT 0 COMMENT '使用次数',
  last_used_at TIMESTAMP NULL COMMENT '最后使用时间',
  status ENUM('available', 'used', 'archived') DEFAULT 'available' COMMENT '状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_source_type (source_type),
  INDEX idx_used_count (used_count),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='素材记录表';
