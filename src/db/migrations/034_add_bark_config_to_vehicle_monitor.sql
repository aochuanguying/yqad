-- Migration: Add Bark configuration to vehicle_monitor_config
-- Created: 2026-07-01
-- Description: Add bark_key and bark_server fields for Bark push notification support

ALTER TABLE vehicle_monitor_config 
ADD COLUMN bark_key VARCHAR(255) DEFAULT '' COMMENT 'Bark 推送键' AFTER alert_phone,
ADD COLUMN bark_server VARCHAR(255) DEFAULT '' COMMENT 'Bark 服务器地址（可选，默认使用官方 API）' AFTER bark_key;
