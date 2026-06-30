/**
 * 生产环境数据库表结构修复脚本
 * 
 * 使用方法：
 * 1. 设置生产环境连接信息
 * 2. 执行：npx tsx scripts/fix-prod-db-schema.ts
 */

import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('fix-prod-db');

// 生产环境配置（从环境变量读取）
const PROD_CONFIG = {
  host: process.env.PROD_MYSQL_HOST || process.env.MYSQL_HOST,
  port: parseInt(process.env.PROD_MYSQL_PORT || process.env.MYSQL_PORT || '3306', 10),
  user: process.env.PROD_MYSQL_USER || process.env.MYSQL_USER,
  password: process.env.PROD_MYSQL_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.PROD_MYSQL_DATABASE || 'yqad_prod_db',
};

// 定义所有表及其必要字段
const TABLE_SCHEMA: Record<string, Array<{name: string; sql: string}>> = {
  scheduler_config: [
    { name: 'cookie_refresh_enabled', sql: "TINYINT(1) DEFAULT 0 COMMENT '是否启用 Cookie 自动刷新'" },
    { name: 'cookie_refresh_cron', sql: "VARCHAR(50) DEFAULT '0 2 * * *' COMMENT 'Cookie 刷新定时表达式'" },
    { name: 'cookie_refresh_auto_enabled', sql: "TINYINT(1) DEFAULT 1 COMMENT '是否启用到期自动刷新'" },
  ],
  material_records: [
    { name: 'source', sql: "VARCHAR(20) DEFAULT 'local' COMMENT '素材来源：local 或 internet'" },
    { name: 'path', sql: 'VARCHAR(500) NOT NULL COMMENT \'文件路径\'' },
    { name: 'url', sql: 'VARCHAR(500) NULL COMMENT \'网络 URL\'' },
    { name: 'quality_score', sql: 'JSON NULL COMMENT \'质量评分\'' },
    { name: 'matched_keywords', sql: 'JSON NULL COMMENT \'匹配的关键词\'' },
    { name: 'associated_posts', sql: 'JSON NULL COMMENT \'关联的帖子\'' },
    { name: 'usage_count', sql: 'INT DEFAULT 0 COMMENT \'使用次数\'' },
    { name: 'last_used_date', sql: 'DATETIME NULL COMMENT \'最后使用日期\'' },
  ],
  network_post_config: [
    { name: 'cookie_version', sql: 'INT DEFAULT 0 COMMENT \'Cookie 版本号\'' },
    { name: 'last_refresh_time', sql: 'DATETIME NULL COMMENT \'最后刷新时间\'' },
    { name: 'next_refresh_time', sql: 'DATETIME NULL COMMENT \'下次刷新时间\'' },
    { name: 'cookie_refresh_logs', sql: 'JSON NULL COMMENT \'Cookie 刷新日志\'' },
  ],
};

async function checkAndFixTable(conn: any, tableName: string, columns: Array<{name: string; sql: string}>): Promise<number> {
  logger.info(`\n📋 检查表：${tableName}`);
  
  // 检查表是否存在
  const tableCheck = await conn.query(`SHOW TABLES LIKE '${tableName}'`);
  const tableExists = Array.isArray(tableCheck) ? tableCheck.length > 0 : false;
  
  if (!tableExists) {
    logger.warn(`⚠️  表 ${tableName} 不存在，跳过检查`);
    return 0;
  }
  
  // 获取现有字段
  const columnsResult: any = await conn.query(`SHOW COLUMNS FROM ${tableName}`);
  let existingColumns: string[] = [];
  
  if (Array.isArray(columnsResult)) {
    if (Array.isArray(columnsResult[0])) {
      existingColumns = columnsResult[0].map((col: any) => col.Field);
    } else {
      existingColumns = columnsResult.map((col: any) => col.Field);
    }
  }
  
  logger.info(`   当前字段：${existingColumns.length} 个`);
  
  // 检查并添加缺失字段
  let addedCount = 0;
  for (const col of columns) {
    if (existingColumns.includes(col.name)) {
      logger.debug(`   �� ${col.name} 已存在`);
    } else {
      logger.info(`   📝 添加字段：${col.name}`);
      try {
        await conn.execute(`ALTER TABLE ${tableName} ADD COLUMN ${col.sql}`);
        logger.info(`   ✅ ${col.name} 添加成功`);
        addedCount++;
      } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          logger.debug(`   ⏭️  ${col.name} 已存在（并发检查）`);
        } else {
          logger.error(`   ❌ 添加 ${col.name} 失败:`, error.message);
        }
      }
    }
  }
  
  return addedCount;
}

async function runMigration() {
  logger.info('='.repeat(60));
  logger.info('🔧 生产环境数据库表结构修复工具');
  logger.info('='.repeat(60));
  
  // 验证配置
  if (!PROD_CONFIG.host || !PROD_CONFIG.user || !PROD_CONFIG.password) {
    logger.error('❌ 错误：缺少数据库连接配置');
    logger.error('请设置以下环境变量之一：');
    logger.error('  - PROD_MYSQL_HOST, PROD_MYSQL_USER, PROD_MYSQL_PASSWORD, PROD_MYSQL_DATABASE');
    logger.error('  - 或 MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE');
    process.exit(1);
  }
  
  logger.info(`\n📊 连接信息:`);
  logger.info(`   主机：${PROD_CONFIG.host}:${PROD_CONFIG.port}`);
  logger.info(`   数据库：${PROD_CONFIG.database}`);
  logger.info(`   用户：${PROD_CONFIG.user}`);
  
  // 确认执行
  logger.info('\n⚠️  即将执行生产环境数据库修复');
  logger.info('此操作将修改数据库表结构');
  
  const conn = MySQLConnectionManager.getInstance();
  
  try {
    await conn.initialize();
    logger.info('✅ 数据库连接成功');
    
    let totalAdded = 0;
    const results: Record<string, number> = {};
    
    // 检查并修复所有表
    for (const [tableName, columns] of Object.entries(TABLE_SCHEMA)) {
      const addedCount = await checkAndFixTable(conn, tableName, columns);
      results[tableName] = addedCount;
      totalAdded += addedCount;
    }
    
    // 输出汇总报告
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 数据库表结构修复完成');
    logger.info('='.repeat(60));
    
    for (const [tableName, count] of Object.entries(results)) {
      if (count > 0) {
        logger.info(`✅ ${tableName}: 添加 ${count} 个字段`);
      } else {
        logger.info(`✅ ${tableName}: 结构完整`);
      }
    }
    
    logger.info('='.repeat(60));
    logger.info(`🎉 总计：添加 ${totalAdded} 个字段`);
    logger.info('='.repeat(60));
    
    logger.info('\n✅ 生产环境数据库修复成功！');
    
  } catch (error) {
    logger.error('❌ 修复失败:', error);
    process.exit(1);
  }
}

// 运行修复
runMigration();
