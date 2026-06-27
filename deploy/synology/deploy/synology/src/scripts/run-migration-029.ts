import * as fs from 'fs';
import * as path from 'path';
import { MySQLConnectionManager } from '../utils/mysql-connection-manager';
import { getLogger } from '../utils/logger';

const logger = getLogger('migration-029');

async function runMigration() {
  logger.info('开始执行迁移 029 - 创建手机短信和未接电话表');
  
  const manager = MySQLConnectionManager.getInstance();
  
  try {
    // 初始化连接
    await manager.initialize();
    logger.info('数据库连接成功');
    
    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, '../db/migrations/029_create_mobile_sms_and_missed_calls_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // 分割 SQL 语句（按分号分隔）
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    // 执行每个语句
    for (const statement of statements) {
      logger.info(`执行 SQL: ${statement.substring(0, 100)}...`);
      await manager.query(statement);
    }
    
    logger.info('✅ 迁移 029 执行成功');
  } catch (error: any) {
    logger.error(`❌ 迁移失败：${error.message}`);
    throw error;
  } finally {
    await manager.shutdown();
    process.exit(0);
  }
}

runMigration().catch(error => {
  logger.error(error);
  process.exit(1);
});
