-- 初始化缺失的配置数据
USE yqad_db;

-- 1. 检查并插入 AI Providers（如果为空）
INSERT INTO ai_providers (name, model, base_url, api_key, priority, enabled)
SELECT 'DeepSeek', 'deepseek-chat', 'https://api.deepseek.com', '', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM ai_providers);

-- 2. 检查并插入内容长度配置（如果为空）
INSERT INTO content_limits_config (comment_min, comment_max, post_min, post_max)
SELECT 10, 100, 50, 500
WHERE NOT EXISTS (SELECT 1 FROM content_limits_config);

-- 3. 检查 AutoJS API 配置（如果为空）
INSERT INTO autojs_api_config (enabled, base_url, api_token, post_script)
SELECT 1, 'http://10.6.0.2:8899', 'api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2', 'audi_post.js'
WHERE NOT EXISTS (SELECT 1 FROM autojs_api_config);

-- 4. 检查车辆监控配置（如果为空）
INSERT INTO vehicle_monitor_config (
  enabled, interval_minutes, quick_interval_minutes, safe_distance_meters, move_threshold_meters,
  min_battery_volt, alert_phone, ha_base_url, ha_token, device_tracker_entity, token
)
SELECT 1, 15, 5, 50, 50, 11.5, '18953272532', 'https://ha.hxfssc.com:8088', 
       'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3OWY2OGIxZmVjZGY0NTE3YjE2ZDI5NjgxN2I0ODJjYyIsImlhdCI6MTc4MTQ4Mzc4MiwiZXhwIjoyMDk2ODQzNzgyfQ.B4MZVRCLwc6w3cvftSNJWW2ZyzZY5jmj1NRcefnj-2g',
       'device_tracker.iphone', ''
WHERE NOT EXISTS (SELECT 1 FROM vehicle_monitor_config);

-- 5. 检查 API 配置（如果为空）
INSERT INTO api_config (mode, base_url, timeout, device_id, nick_name, ip_region)
SELECT 'real', 'https://audi2c.faw-vw.com', 10000, 'AUDI_APP_iPhone_71A0E430-DB97-448F-868A-A6352E31FC13_26.5_6.1.1', '王大锤', '山东省'
WHERE NOT EXISTS (SELECT 1 FROM api_config);

-- 6. 检查评论配置（如果为空）
INSERT INTO comment_config (enabled, daily_limit, avoid_repeat_posts, min_interval_seconds, max_interval_seconds)
SELECT 1, 20, 7, 30, 120
WHERE NOT EXISTS (SELECT 1 FROM comment_config);

-- 显示所有配置表的数据状态
SELECT 'ai_providers' as table_name, COUNT(*) as row_count FROM ai_providers
UNION ALL
SELECT 'content_limits_config', COUNT(*) FROM content_limits_config
UNION ALL
SELECT 'autojs_api_config', COUNT(*) FROM autojs_api_config
UNION ALL
SELECT 'vehicle_monitor_config', COUNT(*) FROM vehicle_monitor_config
UNION ALL
SELECT 'api_config', COUNT(*) FROM api_config
UNION ALL
SELECT 'comment_config', COUNT(*) FROM comment_config;
