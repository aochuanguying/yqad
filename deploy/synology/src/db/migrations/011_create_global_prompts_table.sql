-- +migrate Up
CREATE TABLE IF NOT EXISTS global_prompts (
  id INT PRIMARY KEY AUTO_INCREMENT COMMENT '主键 ID',
  personal_info JSON NOT NULL COMMENT '个人信息（车型、性别、年龄段等）',
  style_description TEXT COMMENT '内容风格描述',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全局人设配置表';

-- +migrate Down
DROP TABLE IF EXISTS global_prompts;
