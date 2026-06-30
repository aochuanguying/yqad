-- Migration 032: Add autohome_selector_warning column to network_post_config table
-- Purpose: Store warning message when autohome selector (.fn-main .post) fails
-- Created: 2026-06-28

ALTER TABLE network_post_config 
ADD COLUMN autohome_selector_warning TEXT DEFAULT NULL 
COMMENT '汽车之家选择器失效警告信息'
AFTER autohome_enabled;
