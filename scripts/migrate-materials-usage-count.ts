/**
 * 数据库迁移脚本：添加 usage_count 字段到 material_records 表
 */

import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('migrate-materials-usage-count');

async function runMigration() {
  const conn = MySQLConnectionManager.getInstance();
  
  try {
    await conn.initialize();
    logger.info('✅ 数据库连接成功');
    
    // 检查字段是否已存在
    const [columns] = await conn.query(`
      SHOW COLUMNS FROM material_records LIKE 'usage_count'
    `);
    
    if (columns && (columns as any[]).length > 0) {
      logger.info('⏭️  usage_count 字段已存在，跳过添加');
    } else {
      logger.info('📝 开始添加 usage_count 和 last_used_date 字段...');
      
      // 添加字段
      await conn.execute(`
        ALTER TABLE material_records 
        ADD COLUMN usage_count INT DEFAULT 0 COMMENT '使用次数',
        ADD COLUMN last_used_date DATETIME NULL COMMENT '最后使用日期'
      `);
      
      logger.info('✅ 字段添加成功');
    }
    
    // 验证迁移结果
    const result = await conn.query(`
      SELECT usage_count, last_used_date 
      FROM material_records 
      LIMIT 1
    `);
    
    const rows = result as any[];
    if (rows && rows.length > 0) {
      const row = rows[0];
      logger.info('📊 当前配置：');
      logger.info(`   - usage_count: ${row.usage_count}`);
      logger.info(`   - last_used_date: ${row.last_used_date || 'null'}`);
    } else {
      logger.info('📊 表为空，字段已就绪');
    }
    
    logger.info('✅ material_records 表 usage_count 字段迁移完成！');
    
  } catch (error) {
    logger.error('❌ 迁移失败:', error);
    process.exit(1);
  }
  
  logger.info('✅ 所有迁移已完成');
  process.exit(0);
}

runMigration();
