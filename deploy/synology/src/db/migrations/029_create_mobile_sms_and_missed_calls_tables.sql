-- 创建手机短信记录表
CREATE TABLE IF NOT EXISTS mobile_sms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL COMMENT '电话号码',
  content TEXT NOT NULL COMMENT '短信内容',
  received_at DATETIME NOT NULL COMMENT '接收时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  INDEX idx_phone_number (phone_number),
  INDEX idx_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='手机短信记录表';

-- 创建未接电话记录表
CREATE TABLE IF NOT EXISTS missed_calls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone_number VARCHAR(50) NOT NULL COMMENT '电话号码',
  received_at DATETIME NOT NULL COMMENT '接收时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  INDEX idx_phone_number (phone_number),
  INDEX idx_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='未接电话记录表';
