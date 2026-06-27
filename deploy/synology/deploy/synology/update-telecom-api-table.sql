-- 从 telecom_api_config 表中删除 api_url 和 api_token 字段
-- 因为这两个字段已经迁移到 mobile_service_config 表

ALTER TABLE telecom_api_config 
DROP COLUMN api_url,
DROP COLUMN api_token;

-- 验证表结构
DESC telecom_api_config;
