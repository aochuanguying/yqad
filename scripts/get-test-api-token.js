#!/usr/bin/env node

/**
 * 从测试环境 Redis 获取 API Token
 */

const redis = require('redis');
const CryptoJS = require('crypto-js');

const REDIS_HOST = '192.168.50.50';
const REDIS_PORT = 6379;
const REDIS_DB = 0;  // 测试环境是 db 0
const ENCRYPTION_KEY = 'yqad-default-encryption-key-2026';

async function getToken() {
  const client = redis.createClient({
    socket: {
      host: REDIS_HOST,
      port: REDIS_PORT
    }
  });

  try {
    await client.connect();
    console.log('✅ Redis 连接成功');
    
    await client.select(REDIS_DB);
    console.log(`✅ 已选择数据库 ${REDIS_DB} (测试环境)`);
    
    const encryptedToken = await client.get('test:api:token');
    
    if (!encryptedToken) {
      console.log('❌ 测试环境未找到 Token');
      await client.disconnect();
      return;
    }
    
    console.log(`\n📦 加密的 Token: ${encryptedToken}`);
    
    // 解密 Token
    const decrypted = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
    
    if (!decrypted) {
      console.log('❌ 解密失败，可能是密钥不正确');
      await client.disconnect();
      return;
    }
    
    console.log(`\n✅ 测试环境 API Token:`);
    console.log(`\n${decrypted}\n`);
    
    await client.disconnect();
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

getToken();
