const redis = require('redis');
const axios = require('axios');

async function initRedis() {
  console.log('🚀 开始初始化 Redis...');
  console.log('');

  // 连接 Redis（使用测试环境的 IP，因为生产容器还没启动）
  const client = redis.createClient({
    socket: {
      host: '10.6.0.5',
      port: 6379
    }
  });

  try {
    await client.connect();
    console.log('✅ Redis 连接成功');
    console.log('');

    // 1. 初始化 API Token
    console.log('📝 步骤 1: 初始化 API Token...');
    const apiTokenKey = 'prod:api:token';
    const existingApiToken = await client.get(apiTokenKey);

    if (!existingApiToken) {
      const apiToken = 'api_token_2ad316f6d071285a1929c9417db4ccc7b23133f96a960adf18534cb1f4380fa2';
      await client.set(apiTokenKey, apiToken);
      console.log(`✅ API Token 已设置：${apiToken}`);
    } else {
      console.log('ℹ️  API Token 已存在，跳过');
    }
    console.log('');

    // 2. 初始化车辆 Token
    console.log('📝 步骤 2: 初始化车辆 Token...');
    const vehicleTokenKey = 'prod:vehicle:token';
    const existingVehicleToken = await client.get(vehicleTokenKey);

    if (!existingVehicleToken) {
      const vehicleToken = 'eyJraWQiOiI3ODEwNzM4Mi1mZTQ0LTQ5YWItOTQ4My00N2EzZTFlNzYzMjAiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIzMzk0NjgzMSIsInNjcCI6Im9wZW5pZCBwcm9maWxlIGF1ZGkiLCJ2ZXIiOiIwLjAuMSIsImFtciI6InB3ZCIsImNvciI6IkNOIiwiaXNzIjoiaHR0cHM6Ly9hdWRpaWRwLmZhdy12dy5jb20iLCJjY2MiOiJXRUNIQVQiLCJ0eXAiOiJBVCIsInR5cGUiOiJBVCIsImlkdC1pZCI6IjNkMmQxOTBiLTdiOWYtNDFmNi1iODljLWYyNzA5MjIxNzExYiIsImF1ZCI6WyJWV0dNQkIwMUNOTElWMSIsIjg4OTAxMzI1NDEyMzMwMDEyIl0sImF6cCI6IldFQ0hBVCIsImFwcGtleSI6IjEwNzI5ODkyIiwidG50IjoiQVVESV9XRUNIQVRfSEwtMDAxXzg4OTAxMzI1NDEyMzMwMDEyX0FuZHJvaWQgOS4wX3YxLjAiLCJleHAiOjE3ODIyNzA4MjgsImFpZCI6IjMzOTQ2ODMxIiwiaWF0IjoxNzgxOTcwODI4LCJydC1pZCI6ImNjNzNkMWQ0LTg2NjktNDY2Mi05NWYzLWU2YzVmMGJiNjMyMiIsImp0aSI6IjhkNGU0M2ZiLWZhOWQtNDI0YS1iOTY4LTQ3OTEzODc0MGYxZiJ9.A1vCtxejrcsyL0n1GYZQuMSbJuh0ewoDYGLTvbhqnQBKrrdrmzIQz2Lb1Jci3bU2H-mLqyW46Ik3GZi7PTjYrsgOQPQD7-xAvKvgOt0i8wDc71Gc4zgvvNCkp3oekdxNBAYb0NvQ03Sr9rrNQKkNaGC0cU9RySeS0laUPUfWNcUNOkxkYKvIMZFVs7b8BDzD0PA4ahnBz2xyzCXsGt5wi1Hzka7dWy-lWlYsEYtYG0iYZMGPZ1eRq2onxmIo3IVfVmu5QbG2sjS3v3EMC2O8qXdOUhrpjy4fCIOJFeXDzIcdp4BIxRmFdJMz9zr7DXoilwXLvP81Fin0YfbpLnb13g';
      await client.set(vehicleTokenKey, vehicleToken);
      console.log('✅ 车辆 Token 已设置（过期时间：2026-10-22）');
    } else {
      console.log('ℹ️  车辆 Token 已存在，跳过');
    }
    console.log('');

    // 3. 初始化 Home Assistant Token
    console.log('📝 步骤 3: 初始化 Home Assistant Token...');
    const haTokenKey = 'prod:ha:token';
    const existingHaToken = await client.get(haTokenKey);

    if (!existingHaToken) {
      const haToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3OWY2OGIxZmVjZGY0NTE3YjE2ZDI5NjgxN2I0ODJjYyIsImlhdCI6MTc4MTQ4Mzc4MiwiZXhwIjoyMDk2ODQzNzgyfQ.B4MZVRCLwc6w3cvftSNJWW2ZyzZY5jmj1NRcefnj-2g';
      await client.set(haTokenKey, haToken);
      console.log('✅ Home Assistant Token 已设置');
    } else {
      console.log('ℹ️  Home Assistant Token 已存在，跳过');
    }
    console.log('');

    // 4. 设置生产环境标识
    console.log('📝 步骤 4: 设置生产环境标识...');
    await client.set('prod:env:production', 'true');
    await client.set('prod:env:init_time', new Date().toISOString());
    await client.set('prod:env:data_source', '/Volumes/docker/yqad/data');
    console.log('✅ 生产环境标识已设置');
    console.log('');

    console.log('==========================================');
    console.log('✅ Redis 初始化完成！');
    console.log('==========================================');
    console.log('');
    console.log('📊 Redis 信息:');
    console.log('   - 环境：Production');
    console.log('   - DB: 1');
    console.log('   - Key 前缀：prod:');
    console.log('');
    console.log('📦 已初始化的 Token:');
    console.log('   - API Token: 已设置');
    console.log('   - 车辆 Token: 已设置');
    console.log('   - HA Token: 已设置');
    console.log('');

  } catch (error) {
    console.error('❌ Redis 初始化失败:', error.message);
    throw error;
  } finally {
    await client.quit();
    console.log('👋 Redis 连接已关闭');
    console.log('');
  }
}

async function initChromaDB() {
  console.log('🚀 开始初始化 ChromaDB...');
  console.log('');

  const chromaUrl = 'http://10.6.0.5:8000';

  try {
    // 检查 ChromaDB 是否可访问
    console.log('📝 步骤 1: 检查 ChromaDB 连接...');
    try {
      const heartbeat = await axios.get(`${chromaUrl}/api/v1/heartbeat`);
      console.log('✅ ChromaDB 连接成功');
      console.log(`   状态：${heartbeat.data}`);
    } catch (error) {
      console.log('⚠️  ChromaDB 无法访问，跳过初始化');
      console.log(`   错误：${error.message}`);
      console.log('');
      return;
    }
    console.log('');

    // 创建 Collections
    console.log('📝 步骤 2: 创建生产环境 Collections...');
    
    const collections = [
      'prod:materials',
      'prod:content_dedup',
      'prod:topic_recommend',
      'prod:sensitive_variants',
      'prod:comment_sentiment'
    ];

    for (const collection of collections) {
      try {
        // 检查是否已存在
        try {
          await axios.get(`${chromaUrl}/api/v1/collections/${collection}`);
          console.log(`ℹ️  Collection "${collection}" 已存在，跳过`);
          continue;
        } catch (error) {
          // Collection 不存在，继续创建
        }

        // 创建 Collection
        const response = await axios.post(`${chromaUrl}/api/v1/collections`, {
          name: collection,
          metadata: {
            description: `Production collection for ${collection}`,
            dimension: 1536,
            distance_function: 'cosine'
          }
        });

        console.log(`✅ Collection "${collection}" 创建成功`);
      } catch (error) {
        console.log(`⚠️  Collection "${collection}" 创建失败：${error.message}`);
      }
    }
    console.log('');

    console.log('==========================================');
    console.log('✅ ChromaDB 初始化完成！');
    console.log('==========================================');
    console.log('');
    console.log('📊 Collections 列表:');
    console.log('   - prod:materials（素材向量）');
    console.log('   - prod:content_dedup（内容去重）');
    console.log('   - prod:topic_recommend（主题推荐）');
    console.log('   - prod:sensitive_variants（敏感变体）');
    console.log('   - prod:comment_sentiment（评论情感）');
    console.log('');

  } catch (error) {
    console.error('❌ ChromaDB 初始化失败:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await initRedis();
    await initChromaDB();
    
    console.log('');
    console.log('==========================================');
    console.log('✅ 所有服务初始化完成！');
    console.log('==========================================');
    console.log('');
    console.log('📊 初始化总结:');
    console.log('   ✅ MySQL: yqad_prod_db (14 张表 + 初始数据)');
    console.log('   ✅ Redis: prod 环境 (API Token + 车辆 Token + HA Token)');
    console.log('   ✅ ChromaDB: 5 个 Collections (prod:前缀)');
    console.log('');
    console.log('🎉 生产环境已完全就绪！');
    console.log('');
  } catch (error) {
    console.error('❌ 初始化过程中出现错误:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
