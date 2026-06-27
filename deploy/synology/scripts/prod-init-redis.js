#!/usr/bin/env node
/**
 * Redis 数据初始化脚本
 * 
 * 用途：
 * 1. 初始化 API Token
 * 2. 初始化敏感词库
 * 3. 初始化车辆 Token（可选）
 * 
 * 使用方法：
 * node scripts/prod-init-redis.js
 */

const Redis = require('ioredis');

// Redis 配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || null,
  db: parseInt(process.env.REDIS_DB) || 0,
  keyPrefix: process.env.REDIS_PREFIX || 'prod:',
};

async function main() {
  console.log('🚀 开始初始化 Redis 数据...\n');
  
  let redis;
  try {
    // 连接 Redis
    console.log('📡 连接 Redis...');
    redis = new Redis(redisConfig);
    
    // 测试连接
    await redis.ping();
    console.log('✅ Redis 连接成功\n');
    
    // 1. 初始化 API Token
    await initApiToken(redis);
    
    // 2. 初始化敏感词库
    await initSensitiveWords(redis);
    
    // 3. 初始化车辆 Token（可选）
    // await initVehicleToken(redis);
    
    console.log('\n✅ Redis 数据初始化完成！\n');
  } catch (error) {
    console.error('❌ Redis 初始化失败:', error.message);
    process.exit(1);
  } finally {
    if (redis) {
      redis.quit();
    }
  }
}

/**
 * 1. 初始化 API Token
 */
async function initApiToken(redis) {
  console.log('1️⃣  初始化 API Token...');
  
  const tokenKey = 'api:token';
  const existingToken = await redis.get(tokenKey);
  
  if (existingToken) {
    console.log('   ⚠️  API Token 已存在，跳过创建');
    return;
  }
  
  // 生成新的 API Token
  const crypto = require('crypto');
  const newToken = `api_token_${crypto.randomBytes(32).toString('hex')}`;
  
  await redis.set(tokenKey, newToken);
  
  console.log('   ✅ API Token 创建成功');
  console.log(`   📝 Token: ${newToken}`);
  console.log('   ⚠️  请妥善保存此 Token，丢失后需重新生成');
}

/**
 * 2. 初始化敏感词库
 */
async function initSensitiveWords(redis) {
  console.log('\n2️⃣  初始化敏感词库...');
  
  const sensitiveWordsKey = 'sensitive:words';
  const existingCount = await redis.scard(sensitiveWordsKey);
  
  if (existingCount > 0) {
    console.log(`   ⚠️  敏感词库已存在 ${existingCount} 个词，跳过创建`);
    return;
  }
  
  // 示例敏感词库（生产环境应使用更权威的来源）
  const sensitiveWords = [
    // 政治相关
    '敏感政治词汇 1',
    '敏感政治词汇 2',
    
    // 违法相关
    '违法词汇 1',
    '违法词汇 2',
    
    // 色情相关
    '色情词汇 1',
    '色情词汇 2',
    
    // 暴力相关
    '暴力词汇 1',
    '暴力词汇 2',
    
    // 广告相关
    '加微信',
    'QQ 群',
    '联系电话',
    '私信我',
  ];
  
  // 批量添加到 Redis 集合
  if (sensitiveWords.length > 0) {
    const pipeline = redis.pipeline();
    for (const word of sensitiveWords) {
      pipeline.sadd(sensitiveWordsKey, word);
    }
    await pipeline.exec();
    
    console.log(`   ✅ 敏感词库创建成功 (${sensitiveWords.length} 个词)`);
    console.log('   📝 敏感词已存储到 Redis 集合');
  } else {
    console.log('   ⚠️  没有敏感词需要初始化');
  }
}

/**
 * 3. 初始化车辆 Token（可选）
 */
async function initVehicleToken(redis) {
  console.log('\n3️⃣  初始化车辆 Token...');
  
  const vehicleTokenKey = 'vehicle:token';
  const existingToken = await redis.get(vehicleTokenKey);
  
  if (existingToken) {
    console.log('   ⚠️  车辆 Token 已存在，跳过创建');
    return;
  }
  
  // 从环境变量读取或生成新 Token
  const vehicleToken = process.env.VEHICLE_TOKEN || '';
  
  if (!vehicleToken) {
    console.log('   ⚠️  未提供车辆 Token，跳过创建');
    console.log('   📝 如需初始化，请设置 VEHICLE_TOKEN 环境变量');
    return;
  }
  
  await redis.set(vehicleTokenKey, vehicleToken);
  await redis.expire(vehicleTokenKey, 86400 * 7); // 7 天 TTL
  
  console.log('   ✅ 车辆 Token 创建成功');
  console.log('   📝 Token 有效期：7 天');
}

// 运行主函数
main().catch(console.error);
