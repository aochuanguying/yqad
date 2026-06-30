/**
 * 数据库迁移脚本：添加 Cookie 定时刷新配置字段
 */

const { MySQLConnectionManager } = require('../src/utils/mysql-connection-manager');
const { getLogger } = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

const logger = getLogger('migrate-cookie-refresh');

async function runMigration() {
  const conn = MySQLConnectionManager.getInstance();
  
  try {
    await conn.initialize();
    logger.info('✅ 数据库连接成功');
    
    // 读取 SQL 迁移文件
    const sqlPath = path.join(__dirname, '../database/migrations/add-cookie-refresh-scheduler.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // 分割 SQL 语句（按分号分隔）
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    logger.info(`📝 准备执行 ${statements.length} 个 SQL 语句...`);
    
    // 执行每个 SQL 语句
    for (const stmt of statements) {
      try {
        logger.info(`执行：${stmt.substring(0, 100)}...`);
        await conn.execute(stmt);
        logger.info('✅ 执行成功');
      } catch (error) {
        // 忽略字段已存在的错误
        if (error.code === 'ER_DUP_FIELDNAME') {
          logger.info('⏭️  字段已存在，跳过');
        } else {
          logger.error('❌ 执行失败:', error.message);
          throw error;
        }
      }
    }
    
    logger.info('✅ Cookie 定时刷新配置迁移完成！');
    
    // 验证迁移结果
    const [rows] = await conn.query(`
      SELECT cookie_refresh_enabled, cookie_refresh_cron, cookie_refresh_auto_enabled 
      FROM scheduler_config 
      LIMIT 1
    `);
    
    if (rows && rows.length > 0) {
      logger.info('📊 当前配置：');
      logger.info(`   - cookie_refresh_enabled: ${rows[0].cookie_refresh_enabled}`);
      logger.info(`   - cookie_refresh_cron: ${rows[0].cookie_refresh_cron}`);
      logger.info(`   - cookie_refresh_auto_enabled: ${rows[0].cookie_refresh_auto_enabled}`);
    }
    
  } catch (error) {
    logger.error('❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    await conn.close();
    logger.info('���� 数据库连接已关闭');
    process.exit(0);
  }
}

runMigration();
