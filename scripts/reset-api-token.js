#!/usr/bin/env node

/**
 * 重置生产环境的 API Token
 */

const redis = require('redis');
const crypto = require('crypto');
const CryptoJS = require('crypto-js');

const REDIS_HOST = '192.168.50.50';
const REDIS_PORT = 6379;
const REDIS_DB = 1;  // 生产环境
const ENCRYPTION_KEY = 'yqad-default-encryption-key-2026';

function generateApiToken() {
  const randomBytes = crypto.randomBytes(32);
  const hexString = randomBytes.toString('hex');
  return `api_token_${hexString}`;
}

async function resetToken() {
  const client = redis.createClient({
    socket: {
      host: REDIS_HOST,
      port: REDIS_PORT
    }
  });

  try {
    await client.connect();
    await client.select(REDIS_DB);
    
    // 生成新 Token
    const newToken = generateApiToken();
    console.log('='.repeat(60));
    console.log('生成新的生产环境 API Token');
    console.log('='.repeat(60));
    console.log(`\n新 Token: ${newToken}\n`);
    
    // 加密 Token
    const encryptedToken = CryptoJS.AES.encrypt(newToken, ENCRYPTION_KEY).toString();
    console.log(`加密后：${encryptedToken}\n`);
    
    // 保存到 Redis
    await client.set('prod:api:token', encryptedToken);
    console.log('✅ Token 已保存到 Redis (prod:api:token)');
    
    console.log('\n使用说明:');
    console.log(`curl -H "Authorization: Bearer ${newToken}" http://192.168.50.50:3000/api/posts/mobile/sms`);
    console.log('='.repeat(60));
    
    await client.disconnect();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

resetToken();
