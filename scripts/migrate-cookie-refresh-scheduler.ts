/**
 * 数据库迁移脚本：添加 Cookie 定时刷新配置字段
 */

import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('migrate-cookie-refresh');

async function runMigration() {
  const conn = MySQLConnectionManager.getInstance();
  
  try {
    await conn.initialize();
    logger.info('✅ 数据库连接成功');
    
    // 检查字段是否已存在
    const [columns] = await conn.query(`
      SHOW COLUMNS FROM scheduler_config LIKE 'cookie_refresh%'
    `);
    
    if (columns && (columns as any[]).length > 0) {
      logger.info('⏭️  Cookie 刷新字段已存在，无需迁移');
      return;
    }
    
    logger.info('📝 开始添加 Cookie 刷新配置字段...');
    
    // 添加字段
    await conn.execute(`
      ALTER TABLE scheduler_config 
      ADD COLUMN cookie_refresh_enabled TINYINT(1) DEFAULT 0 COMMENT '是否启用 Cookie 自动刷新',
      ADD COLUMN cookie_refresh_cron VARCHAR(50) DEFAULT '0 2 * * *' COMMENT 'Cookie 刷新定时表达式（默认每天凌晨 2 点）',
      ADD COLUMN cookie_refresh_auto_enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用到期自动刷新（提前 1 小时）'
    `);
    
    logger.info('✅ 字段添加成功');
    
    // 验证迁移结果
    const [rows] = await conn.query(`
      SELECT cookie_refresh_enabled, cookie_refresh_cron, cookie_refresh_auto_enabled 
      FROM scheduler_config 
      LIMIT 1
    `);
    
    if (rows && (rows as any[]).length > 0) {
      const row = (rows as any[])[0];
      logger.info('📊 当前配置：');
      logger.info(`   - cookie_refresh_enabled: ${row.cookie_refresh_enabled}`);
      logger.info(`   - cookie_refresh_cron: ${row.cookie_refresh_cron}`);
      logger.info(`   - cookie_refresh_auto_enabled: ${row.cookie_refresh_auto_enabled}`);
    }
    
    logger.info('✅ Cookie 定时刷新配置迁移完成！');
    
  } catch (error) {
    logger.error('❌ 迁移失败:', error);
    process.exit(1);
  }
  
  logger.info('✅ 所有迁移已完成');
  process.exit(0);
}

runMigration();
