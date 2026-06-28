/**
 * 初始化生产环境数据库表和数据
 */

import MySQLConnectionManager from '../src/utils/mysql-connection-manager';
import { getLogger } from '../src/utils/logger';
import * as bcrypt from 'bcryptjs';

const logger = getLogger('init-database');

async function initDatabase() {
  // 强制使用生产环境
  process.env.NODE_ENV = 'production';
  
  logger.info('开始初始化生产环境数据库...');
  
  try {
    // 初始化 MySQL 连接
    const manager = MySQLConnectionManager.getInstance();
    await manager.initialize();
    
    logger.info('✅ MySQL 连接成功');
    
    // 1. 初始化车辆监控 Token（生成随机 Token）
    const randomToken = 'token_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    await manager.query(
      `UPDATE vehicle_monitor_config SET token = ? WHERE id = 1`,
      [randomToken]
    );
    
    logger.info(`✅ 车辆监控 Token 已初始化：${randomToken}`);
    logger.info('请在 Web 界面"车辆监控配置"页面查看或修改 Token');
    
    // 2. 初始化评论配置（如果不存在）
    await manager.query(`
      INSERT INTO comment_config (enabled, daily_limit, delay_min, delay_max, max_fetch_pages)
      SELECT 0, 3, 60, 180, 5
      WHERE NOT EXISTS (SELECT 1 FROM comment_config)
    `);
    
    logger.info('✅ 评论配置已初始化');
    
    // 3. 初始化发帖配置（如果不存在）
    try {
      await manager.query(`
        INSERT INTO post_config (enabled, daily_limit, delay_min, delay_max)
        SELECT 0, 1, 0, 300
        WHERE NOT EXISTS (SELECT 1 FROM post_config)
      `);
      logger.info('✅ 发帖配置已初始化');
    } catch (error) {
      logger.warn('发帖配置表可能不存在，跳过初始化');
    }
    
    // 4. 初始化调度器配置（如果不存在）
    try {
      await manager.query(`
        INSERT INTO scheduler_config (key_name, config_value)
        SELECT 'auto_comment_enabled', 'true'
        WHERE NOT EXISTS (SELECT 1 FROM scheduler_config WHERE key_name = 'auto_comment_enabled')
      `);
      
      await manager.query(`
        INSERT INTO scheduler_config (key_name, config_value)
        SELECT 'auto_post_enabled', 'true'
        WHERE NOT EXISTS (SELECT 1 FROM scheduler_config WHERE key_name = 'auto_post_enabled')
      `);
      
      logger.info('✅ 调度器配置已初始化');
    } catch (error) {
      logger.warn('调度器配置表可能不存在，跳过初始化');
    }
    
    // 5. 创建用户表（如果不存在）
    try {
      await manager.query(`
        CREATE TABLE IF NOT EXISTS members (
          id VARCHAR(36) PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(100),
          phone VARCHAR(20),
          avatar_url VARCHAR(500),
          status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
          role ENUM('admin', 'user', 'guest') DEFAULT 'user',
          post_count INT DEFAULT 0,
          comment_count INT DEFAULT 0,
          last_login_at DATETIME,
          last_login_ip VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_username (username),
          INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      logger.info('✅ members 表创建成功');
    } catch (error) {
      logger.error('创建 members 表失败:', error instanceof Error ? error.message : String(error));
    }
    
    // 6. 初始化默认用户
    logger.info('正在初始化默认用户...');
    const defaultUsername = 'admin';
    const defaultPassword = 'admin123';
    logger.info(`正在生成密码哈希...`);
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    logger.info(`密码哈希已生成：${passwordHash.substring(0, 20)}...`);
    
    try {
      const existingUser = await manager.query<any[]>(
        `SELECT id, username FROM members WHERE username = ?`,
        [defaultUsername]
      );
      
      logger.info(`查询结果：${existingUser.length} 条记录`);
      
      if (existingUser.length === 0) {
        logger.info(`正在创建用户 ${defaultUsername}...`);
        await manager.query(`
          INSERT INTO members (id, username, password_hash, email, status, created_at, updated_at)
          VALUES (UUID(), ?, ?, 'admin@example.com', 'active', NOW(), NOW())
        `, [defaultUsername, passwordHash]);
        logger.info(`✅ 默认用户已创建：${defaultUsername} / ${defaultPassword}`);
      } else {
        logger.info(`用户 ${defaultUsername} 已存在，正在更新密码...`);
        await manager.query(
          `UPDATE members SET password_hash = ? WHERE username = ?`,
          [passwordHash, defaultUsername]
        );
        logger.info(`✅ 默认用户密码已重置：${defaultUsername} / ${defaultPassword}`);
      }
      
      // 验证用户是否存在
      const verifyUser = await manager.query<any[]>(
        `SELECT id, username, email FROM members WHERE username = ?`,
        [defaultUsername]
      );
      logger.info(`验证查询结果:`, verifyUser);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'no stack';
      logger.error('用户初始化失败:', errorMsg);
      logger.error('错误堆栈:', errorStack);
    }
    
    logger.info('\n========================================');
    logger.info('数据库初始化完���！');
    logger.info('========================================');
    logger.info(`车辆监控 Token: ${randomToken}`);
    logger.info(`默认用户：${defaultUsername} / ${defaultPassword}`);
    logger.info('访问 http://localhost:3000 登录 Web 管理界面');
    logger.info('========================================\n');
    
    // 关闭连接
    await manager.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error('初始化失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

initDatabase();
