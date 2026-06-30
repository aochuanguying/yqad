/**
 * 数据库迁移脚本：补全 material_records 表所有缺失字段
 */

import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('migrate-materials-complete');

async function runMigration() {
  const conn = MySQLConnectionManager.getInstance();
  
  try {
    await conn.initialize();
    logger.info('✅ 数据库连接成功');
    
    // 获取现有字段
    const columnsResult: any = await conn.query('SHOW COLUMNS FROM material_records');
    logger.debug('查询结果类型:', typeof columnsResult);
    logger.debug('查询结果:', JSON.stringify(columnsResult, null, 2));
    
    let existingColumns: string[] = [];
    if (Array.isArray(columnsResult)) {
      // 如果是数组，可能是 [rows, fields]
      if (Array.isArray(columnsResult[0])) {
        existingColumns = columnsResult[0].map((col: any) => col.Field);
      } else {
        existingColumns = columnsResult.map((col: any) => col.Field);
      }
    } else if (columnsResult && typeof columnsResult === 'object') {
      // 如果直接是 rows
      if (Array.isArray((columnsResult as any)[0])) {
        existingColumns = (columnsResult as any)[0].map((col: any) => col.Field);
      }
    }
    
    logger.info(`📊 当前已有字段：${existingColumns.join(', ')}`);
    
    // 定义需要添加的字段
    const columnsToAdd = [
      { name: 'source', sql: "source VARCHAR(20) DEFAULT 'local' COMMENT '素材来源：local 或 internet'" },
      { name: 'path', sql: 'path VARCHAR(500) NOT NULL COMMENT \'文件路径\'' },
      { name: 'url', sql: 'url VARCHAR(500) NULL COMMENT \'网络 URL\'' },
      { name: 'quality_score', sql: 'quality_score JSON NULL COMMENT \'质量评分\'' },
      { name: 'matched_keywords', sql: 'matched_keywords JSON NULL COMMENT \'匹配的关键词\'' },
      { name: 'associated_posts', sql: 'associated_posts JSON NULL COMMENT \'关联的帖子\'' },
      { name: 'created_at', sql: 'created_at DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', sql: 'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
    ];
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const col of columnsToAdd) {
      if (existingColumns.includes(col.name)) {
        logger.info(`⏭️  字段 [${col.name}] 已存在，跳过`);
        skippedCount++;
      } else {
        logger.info(`📝 添加字段：${col.name}`);
        await conn.execute(`ALTER TABLE material_records ADD COLUMN ${col.sql}`);
        logger.info(`✅ 字段 [${col.name}] 添加成功`);
        addedCount++;
      }
    }
    
    logger.info(`✅ material_records 表结构补全完成！新增：${addedCount}, 跳过：${skippedCount}`);
    
  } catch (error) {
    logger.error('❌ 迁移失败:', error);
    process.exit(1);
  }
  
  logger.info('✅ 所有迁移已完成');
  process.exit(0);
}

runMigration();
