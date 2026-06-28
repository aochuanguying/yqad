#!/usr/bin/env node

/**
 * 为 featured_posting_config 表添加 recommended_images 字段
 */

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: '192.168.50.50',
  port: 3306,
  user: 'root',
  password: 'Wfw7539148@',
  database: 'yqad_prod_db',
};

async function migrate() {
  let connection;
  
  try {
    console.log('正在连接 MySQL...');
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ MySQL 连接成功');
    
    // 检查字段是否存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'featured_posting_config' 
        AND COLUMN_NAME = 'recommended_images'
    `, [DB_CONFIG.database]);
    
    if (columns.length > 0) {
      console.log('✅ recommended_images 字段已存在，无需迁移');
      return;
    }
    
    console.log('⏳ 开始添加 recommended_images 字段...');
    
    // 添加字段
    await connection.query(`
      ALTER TABLE featured_posting_config 
      ADD COLUMN recommended_images INT DEFAULT 6 AFTER max_images
    `);
    
    console.log('✅ recommended_images 字段添加成功');
    
    // 更新现有数据
    await connection.query(`
      UPDATE featured_posting_config 
      SET recommended_images = 6 
      WHERE recommended_images IS NULL
    `);
    
    console.log('✅ 数据更新完成');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('MySQL 连接已关闭');
    }
  }
}

migrate();
