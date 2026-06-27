/**
 * 创建 AI Providers 表并初始化数据
 */

import * as fs from 'fs';
import * as path from 'path';
import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('create-ai-providers-table');

async function main() {
  try {
    logger.info('开始创建 AI Providers 表...');
    
    // 获取 MySQL 连接
    const manager = MySQLConnectionManager.getInstance();
    await manager.initialize();
    
    const connection = await manager.getConnection();
    try {
      // 读取 SQL 文件
      const sqlPath = path.join(__dirname, 'create-ai-providers-table.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      
      // 分割 SQL 语句（按分号分隔）
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      // 执行每个 SQL 语句
      for (const statement of statements) {
        logger.info(`执行 SQL: ${statement.substring(0, 100)}...`);
        await connection.execute(statement);
      }
      
      logger.info('✅ AI Providers 表创建成功！');
      
      // 验证数据
      const [rows]: any[] = await connection.execute('SELECT name, model, base_url FROM ai_providers ORDER BY priority');
      logger.info(`插入了 ${rows.length} 条记录:`);
      for (const row of rows) {
        logger.info(`  - ${row.name}: ${row.model} (${row.base_url})`);
      }
      
    } finally {
      await connection.release();
    }
    
    await manager.shutdown();
    logger.info('MySQL 连接已关闭');
    
  } catch (error) {
    logger.error('创建表失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
