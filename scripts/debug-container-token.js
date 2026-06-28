#!/usr/bin/env node

/**
 * 在容器内调试 Token - 这个脚本需要在 Docker 容器内运行
 * 用法：docker exec yqad node scripts/debug-container-token.js
 */

const path = require('path');

// 模拟容器内环境
process.env.NODE_ENV = 'production';

async function debugToken() {
  console.log('='.repeat(60));
  console.log('Docker 容器内 Token 调试');
  console.log('='.repeat(60));
  
  console.log('\n1️⃣  环境变量:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   TOKEN_ENCRYPTION_KEY: ${process.env.TOKEN_ENCRYPTION_KEY || '(未设置，使用默认值)'}`);
  
  // 加载配置
  const { loadConfig } = require('./src/utils/config');
  const config = loadConfig();
  
  console.log('\n2️⃣  配置文件:');
  console.log(`   env: ${config.env}`);
  console.log(`   Redis: ${config.redis[config.env].host}:${config.redis[config.env].port}`);
  console.log(`   Redis DB: ${config.redis[config.env].db}`);
  console.log(`   Redis Prefix: ${config.redis[config.env].keyPrefix}`);
  
  // 初始化 Redis
  const { getRedisClient, formatKey } = require('./src/storage/redis');
  const client = getRedisClient();
  
  const tokenKey = formatKey('api:token');
  console.log(`\n3️⃣  Token 键名：${tokenKey}`);
  
  const encryptedToken = await client.get(tokenKey);
  
  if (!encryptedToken) {
    console.log(`\n❌ Redis 中未找到 Token: ${tokenKey}`);
    
    // 尝试其他可能的键名
    const altKeys = ['api:token', 'prod:api:token', 'test:api:token'];
    for (const key of altKeys) {
      const value = await client.get(key);
      if (value) {
        console.log(`⚠️  找到键 ${key}: ${value.substring(0, 50)}...`);
      }
    }
    
    return;
  }
  
  console.log(`\n4️⃣  加密的 Token:`);
  console.log(`   ${encryptedToken.substring(0, 50)}...`);
  
  // 尝试解密
  const CryptoJS = require('crypto-js');
  const defaultKey = 'yqad-default-encryption-key-2026';
  const envKey = process.env.TOKEN_ENCRYPTION_KEY;
  
  const keysToTry = envKey ? [envKey, defaultKey] : [defaultKey];
  
  for (const key of keysToTry) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedToken, key).toString(CryptoJS.enc.Utf8);
      if (decrypted && decrypted.startsWith('api_token_')) {
        console.log(`\n5️⃣  ✅ 解密成功 (密钥：${key}):`);
        console.log(`   ${decrypted}`);
        console.log(`\n6️⃣  使用此 Token 测试:`);
        console.log(`   curl -H "Authorization: Bearer ${decrypted}" http://localhost:3000/api/posts/mobile/sms`);
        return;
      }
    } catch (e) {
      // 继续尝试下一个
    }
  }
  
  console.log('\n❌ 所有密钥都解密失败');
}

debugToken().catch(console.error);
