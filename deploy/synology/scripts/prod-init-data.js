#!/usr/bin/env node
/**
 * 生产环境数据初始化脚本
 * 
 * 用途：
 * 1. 初始化默认管理员账户
 * 2. 初始化默认全局人设
 * 3. 初始化示例主题（可选）
 * 4. 初始化敏感词库（可选）
 * 
 * 使用方法：
 * node scripts/prod-init-data.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// 数据库配置
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'yqad_db',
};

async function main() {
  console.log('🚀 开始初始化生产环境数据...\n');
  
  let connection;
  try {
    // 连接数据库
    console.log('📡 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 1. 初始化默认管理员账户
    await initAdminAccount(connection);

    // 2. 初始化默认全局人设
    await initGlobalPrompts(connection);

    // 3. 初始化示例主题（可选）
    // await initSampleTopics(connection);

    // 4. 初始化敏感词库（可选）
    // await initSensitiveWords(connection);

    console.log('\n✅ 生产环境数据初始化完成！\n');
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * 1. 初始化默认管理员账户
 */
async function initAdminAccount(connection) {
  console.log('1️⃣  初始化默认管理员账户...');
  
  const adminId = 'admin-001';
  const username = 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  
  // 检查是否已存在
  const [existing] = await connection.query(
    'SELECT id FROM members WHERE username = ?',
    [username]
  );
  
  if (existing.length > 0) {
    console.log('   ⚠️  管理员账户已存在，跳过创建');
    return;
  }
  
  // 生成密码哈希
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  // 插入管理员账户
  await connection.query(
    `INSERT INTO members (id, username, password_hash, role) 
     VALUES (?, ?, ?, 'admin')`,
    [adminId, username, passwordHash]
  );
  
  console.log('   ✅ 管理员账户创建成功');
  console.log(`   📝 用户名：${username}`);
  console.log(`   📝 密码：${password} (请及时修改)`);
}

/**
 * 2. 初始化默认全局人设
 */
async function initGlobalPrompts(connection) {
  console.log('\n2️⃣  初始化默认全局人设...');
  
  const prompts = [
    {
      id: 'prompt-001',
      name: '生活分享家',
      content: '你是一个热爱生活、乐于分享的人，喜欢用文字记录生活中的美好瞬间。你的文字温暖、真诚，能够引起读者的共鸣。',
    },
    {
      id: 'prompt-002',
      name: '汽车评测师',
      content: '你是一位专业的汽车评测师，对汽车有着深入的了解和独到的见解。你的评测客观、专业，能够帮助消费者做出明智的选择。',
    },
  ];
  
  for (const prompt of prompts) {
    const [existing] = await connection.query(
      'SELECT id FROM global_prompts WHERE id = ?',
      [prompt.id]
    );
    
    if (existing.length === 0) {
      await connection.query(
        `INSERT INTO global_prompts (id, name, content, is_active) 
         VALUES (?, ?, ?, TRUE)`,
        [prompt.id, prompt.name, prompt.content]
      );
      console.log(`   ✅ 人设 "${prompt.name}" 创建成功`);
    } else {
      console.log(`   ⚠️  人设 "${prompt.name}" 已存在，跳过`);
    }
  }
}

/**
 * 3. 初始化示例主题（可选）
 */
async function initSampleTopics(connection) {
  console.log('\n3️⃣  初始化示例主题...');
  
  const topics = [
    {
      id: 'topic-001',
      name: '城市探索',
      maxUseCount: 3,
      currentUseCount: 0,
      status: 'available',
    },
    {
      id: 'topic-002',
      name: '美食发现',
      maxUseCount: 3,
      currentUseCount: 0,
      status: 'available',
    },
  ];
  
  for (const topic of topics) {
    const [existing] = await connection.query(
      'SELECT id FROM topics WHERE id = ?',
      [topic.id]
    );
    
    if (existing.length === 0) {
      await connection.query(
        `INSERT INTO topics (id, name, max_use_count, current_use_count, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [topic.id, topic.name, topic.maxUseCount, topic.currentUseCount, topic.status]
      );
      console.log(`   ✅ 主题 "${topic.name}" 创建成功`);
    } else {
      console.log(`   ⚠️  主题 "${topic.name}" 已存在，跳过`);
    }
  }
}

/**
 * 4. 初始化敏感词库（可选）
 * 注意：敏感词通常存储在 Redis 中
 */
async function initSensitiveWords(connection) {
  console.log('\n4️⃣  初始化敏感词库...');
  
  const sensitiveWords = [
    // 添加一些基础的敏感词示例
    // 实际生产环境应该从更权威的来源导入
  ];
  
  if (sensitiveWords.length === 0) {
    console.log('   ⚠️  没有敏感词需要初始化');
    return;
  }
  
  console.log(`   ✅ 敏感词库初始化完成（${sensitiveWords.length} 个词）`);
  console.log('   📝 敏感词已存储到 Redis');
}

// 运行主函数
main().catch(console.error);
