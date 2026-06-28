/**
 * 安全初始化生产环境数据库
 * - 检查表是否存在，只创建缺失的表
 * - 检查数据是否存在，只插入缺失的数据
 * - 不覆盖已有数据
 */

import MySQLConnectionManager from '../src/utils/mysql-connection-manager';
import { getLogger } from '../src/utils/logger';
import * as bcrypt from 'bcryptjs';

const logger = getLogger('safe-init-database');

async function safeInitDatabase() {
  // 强制使用生产环境
  process.env.NODE_ENV = 'production';
  
  logger.info('========================================');
  logger.info('开始安全初始化生产环境数据库...');
  logger.info('========================================\n');
  
  try {
    // 初始化 MySQL 连接
    const manager = MySQLConnectionManager.getInstance();
    await manager.initialize();
    
    logger.info('✅ MySQL 连接成功\n');
    
    // 1. 执行所有迁移脚本（确保表结构完整）
    logger.info('📝 步骤 1: 执行数据库迁移...');
    await executeMigrations(manager);
    logger.info('✅ 数据库迁移完成\n');
    
    // 2. 初始化车辆监控 Token（仅当不存在时）
    logger.info('📝 步骤 2: 初始化车辆监控配置...');
    await initVehicleMonitorConfig(manager);
    
    // 3. 初始化评论配置
    logger.info('📝 步骤 3: 初始化评论配置...');
    await initCommentConfig(manager);
    
    // 4. 初始化发帖配置
    logger.info('📝 步骤 4: 初始化发帖配置...');
    await initPostConfig(manager);
    
    // 5. 初始化调度器配置
    logger.info('📝 步骤 5: 初始化调度器配置...');
    await initSchedulerConfig(manager);
    
    // 6. 初始化默认用户
    logger.info('📝 步骤 6: 初始化默认用户...');
    await initDefaultUser(manager);
    
    // 7. 初始化 AI Provider 配置
    logger.info('📝 步骤 7: 初始化 AI Provider 配置...');
    await initAIProviders(manager);
    
    logger.info('\n========================================');
    logger.info('✅ 数据库安全初始化完成！');
    logger.info('========================================');
    logger.info('\n提示：');
    logger.info('- 所有操作都不会影响已有数据');
    logger.info('- 如需查看详细信息，请检查上面的日志');
    logger.info('- 访问 Web 管理界面进行配置\n');
    
    // 关闭连接
    await manager.shutdown();
    process.exit(0);
  } catch (error) {
    logger.error('\n❌ 初始化失败:', error instanceof Error ? error.message : String(error));
    logger.error('错误堆栈:', error instanceof Error ? error.stack : 'no stack');
    process.exit(1);
  }
}

/**
 * 执行所有数据库迁移脚本
 */
async function executeMigrations(manager: MySQLConnectionManager) {
  const fs = await import('fs');
  const path = await import('path');
  
  const migrationsDir = path.join(__dirname, '../src/db/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  logger.info(`   发现 ${files.length} 个迁移文件`);
  
  for (const file of files) {
    try {
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      const upMatch = sqlContent.match(/-- \+migrate Up([\s\S]*?)(-- \+migrate Down|$)/);
      
      if (!upMatch) {
        logger.warn(`   ⚠️  跳过 ${file}：未找到 +migrate Up 标记`);
        continue;
      }
      
      const sql = upMatch[1].trim();
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await manager.query(statement);
        }
      }
      logger.info(`   ✅ ${file}`);
    } catch (error: any) {
      logger.warn(`   ⚠️  ${file} 执行警告：${error.message}`);
    }
  }
}

/**
 * 初始化车辆监控配置
 */
async function initVehicleMonitorConfig(manager: MySQLConnectionManager) {
  try {
    // 检查记录是否存在
    const existing = await manager.query<any[]>(
      `SELECT id, token FROM vehicle_monitor_config WHERE id = 1`
    );
    
    if (existing.length > 0) {
      logger.info(`   ⏭️  车辆监控配置已存在，跳过初始化`);
      logger.info(`      Token: ${existing[0].token || '未设置'}`);
      return;
    }
    
    // 生成随机 Token
    const randomToken = 'token_' + 
      Math.random().toString(36).substring(2, 15) + 
      Math.random().toString(36).substring(2, 15);
    
    await manager.query(`
      INSERT INTO vehicle_monitor_config (id, enabled, token, created_at, updated_at)
      VALUES (1, 0, ?, NOW(), NOW())
    `, [randomToken]);
    
    logger.info(`   ✅ 车辆监控配置已创建`);
    logger.info(`      Token: ${randomToken}`);
    logger.info(`      状态：已禁用 (可在 Web 界面启用)`);
  } catch (error: any) {
    logger.warn(`   ⚠️  车辆监控配置初始化失败：${error.message}`);
  }
}

/**
 * 初始化评论配置
 */
async function initCommentConfig(manager: MySQLConnectionManager) {
  try {
    const existing = await manager.query<any[]>(
      `SELECT id FROM comment_config LIMIT 1`
    );
    
    if (existing.length > 0) {
      logger.info(`   ⏭️  评论配置已存在，跳过初始化`);
      return;
    }
    
    await manager.query(`
      INSERT INTO comment_config (enabled, daily_limit, delay_min, delay_max, max_fetch_pages)
      VALUES (0, 3, 60, 180, 5)
    `);
    
    logger.info(`   ✅ 评论配置已创建`);
    logger.info(`      状态：已禁用`);
    logger.info(`      每日限制：3 条`);
  } catch (error: any) {
    logger.warn(`   ⚠️  评论配置初始化失败：${error.message}`);
  }
}

/**
 * 初始化发帖配置
 */
async function initPostConfig(manager: MySQLConnectionManager) {
  try {
    const existing = await manager.query<any[]>(
      `SELECT id FROM post_config LIMIT 1`
    );
    
    if (existing.length > 0) {
      logger.info(`   ⏭️  发帖配置已存在，跳过初始化`);
      return;
    }
    
    await manager.query(`
      INSERT INTO post_config (enabled, daily_limit, delay_min, delay_max)
      VALUES (0, 1, 0, 300)
    `);
    
    logger.info(`   ✅ 发帖配置已创建`);
    logger.info(`      状态：已禁用`);
    logger.info(`      每日限制：1 条`);
  } catch (error: any) {
    logger.warn(`   ⚠️  发帖配置初始化失败：${error.message}`);
  }
}

/**
 * 初始化调度器配置
 */
async function initSchedulerConfig(manager: MySQLConnectionManager) {
  try {
    const configs = [
      { key: 'auto_comment_enabled', value: 'true', desc: '自动评论' },
      { key: 'auto_post_enabled', value: 'true', desc: '自动发帖' }
    ];
    
    for (const config of configs) {
      const existing = await manager.query<any[]>(
        `SELECT id FROM scheduler_config WHERE key_name = ?`,
        [config.key]
      );
      
      if (existing.length > 0) {
        logger.info(`   ⏭️  ${config.desc}配置已存在，跳过`);
        continue;
      }
      
      await manager.query(`
        INSERT INTO scheduler_config (key_name, config_value)
        VALUES (?, ?)
      `, [config.key, config.value]);
      
      logger.info(`   ✅ ${config.desc}配置已创建`);
    }
  } catch (error: any) {
    logger.warn(`   ⚠️  调度器配置初始化失败：${error.message}`);
  }
}

/**
 * 初始化默认用户
 */
async function initDefaultUser(manager: MySQLConnectionManager) {
  try {
    const defaultUsername = 'admin';
    const defaultPassword = 'admin123';
    
    // 检查用户是否存在
    const existing = await manager.query<any[]>(
      `SELECT id, username, email FROM members WHERE username = ?`,
      [defaultUsername]
    );
    
    if (existing.length > 0) {
      logger.info(`   ⏭️  管理员账户已存在：${existing[0].username}`);
      logger.info(`      邮箱：${existing[0].email || '未设置'}`);
      logger.info(`      提示：不会重置密码，如需重置请使用 Web 界面`);
      return;
    }
    
    // 生成密码哈希
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    
    // 根据实际表结构调整 INSERT 语句
    await manager.query(`
      INSERT INTO members (id, username, password_hash, email, status, created_at, updated_at)
      VALUES (UUID(), ?, ?, 'admin@example.com', 'active', NOW(), NOW())
    `, [defaultUsername, passwordHash]);
    
    logger.info(`   ✅ 管理员账户已创建`);
    logger.info(`      用户名：${defaultUsername}`);
    logger.info(`      密码：${defaultPassword}`);
    logger.info(`      ⚠️  首次登录后请立即修改密码！`);
  } catch (error: any) {
    logger.error(`   ❌ 管理员账户初始化失败：${error.message}`);
  }
}

/**
 * 初始化 AI Provider 配置
 */
async function initAIProviders(manager: MySQLConnectionManager) {
  try {
    const existing = await manager.query<any[]>(
      `SELECT id FROM ai_providers LIMIT 1`
    );
    
    if (existing.length > 0) {
      logger.info(`   ⏭️  AI Provider 配置已存在，跳过初始化`);
      return;
    }
    
    // 添加默认的 AI Provider 配置（不设置实际的 API Key）
    logger.info(`   ℹ️  AI Provider 表已创建，但未添加默认 Provider`);
    logger.info(`      请在 Web 界面"AI Provider 管理"页面添加配置`);
  } catch (error: any) {
    logger.warn(`   ⚠️  AI Provider 初始化失败：${error.message}`);
  }
}

// 执行初始化
safeInitDatabase();
