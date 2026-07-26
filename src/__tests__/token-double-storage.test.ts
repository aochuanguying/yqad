/**
 * Token 双重存储完整测试
 * 
 * 测试场景：
 * 1. 保存 Token 到双重存储
 * 2. 从 Redis 读取
 * 3. 从数据库读取
 * 4. Redis 故障时从数据库恢复
 */

import { MySQLConnectionManager } from '../utils/mysql-connection-manager';
import { authTokenStorage } from '../storage/redis/auth-token-storage';
import { authTokenDatabaseStorage } from '../storage/mysql/auth-token-storage';
import { getLogger } from '../utils/logger';

const logger = getLogger('test-token-storage');

async function testDoubleStorage() {
  console.log('\n========================================');
  console.log('📝 测试 Token 双重存储');
  console.log('========================================\n');
  
  try {
    // 初始化数据库连接
    const db = MySQLConnectionManager.getInstance();
    await db.initialize();
    
    // 模拟一个 Token
    const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test_token_for_storage_test';
    const expiresAt = new Date(Date.now() + 83 * 3600 * 1000); // 83 小时后
    
    console.log('【测试 1】保存 Token 到双重存储...');
    
    // 保存到 Redis
    console.log('保存到 Redis...');
    await authTokenStorage.saveToken(testToken);
    console.log('✅ Redis 保存成功');
    
    // 保存到数据库
    console.log('保存到数据库...');
    const saved = await authTokenDatabaseStorage.saveToken({
      access_token: testToken,
      expires_at: expiresAt,
      refreshed_at: new Date(),
      refresh_source: 'test',
    });
    console.log(saved ? '✅ 数据库保存成功' : '❌ 数据库保存失败');
    
    console.log('\n【测试 2】从 Redis 读取 Token...');
    const redisToken = await authTokenStorage.getToken();
    console.log(`Redis Token: ${redisToken ? redisToken.substring(0, 50) + '...' : '无'}`);
    console.log(redisToken === testToken ? '✅ Redis 读取正确' : '❌ Redis 读取错误');
    
    console.log('\n【测试 3】从数据库读取 Token...');
    const dbToken = await authTokenDatabaseStorage.getToken();
    console.log(`数据库 Token: ${dbToken ? dbToken.access_token.substring(0, 50) + '...' : '无'}`);
    console.log(`数据库过期时间：${dbToken ? dbToken.expires_at : '无'}`);
    console.log(`数据库刷新来源：${dbToken ? dbToken.refresh_source : '无'}`);
    console.log(dbToken && dbToken.access_token === testToken ? '✅ 数据库读取正确' : '❌ 数据库读取错误');
    
    console.log('\n【测试 4】查询数据库 Token 记录...');
    const [rows]: any[] = await db.execute(`
      SELECT 
        id,
        access_token,
        refreshed_at,
        refresh_source,
        expires_at,
        TIMESTAMPDIFF(HOUR, NOW(), expires_at) as hours_remaining
      FROM auth_tokens
      ORDER BY refreshed_at DESC
      LIMIT 5
    `);
    
    if (rows && rows.length > 0) {
      console.log('最近 5 条 Token 记录:');
      rows.forEach((row: any) => {
        console.log(`  - ID: ${row.id}, 来源：${row.refresh_source}, 剩余：${row.hours_remaining}小时`);
      });
    } else {
      console.log('数据库中无 Token 记录');
    }
    
    console.log('\n【测试 5】模拟 Redis 故障，从数据库恢复...');
    
    // 删除 Redis 中的 Token
    console.log('删除 Redis Token...');
    await authTokenStorage.deleteToken();
    const redisTokenAfterDelete = await authTokenStorage.getToken();
    console.log(`Redis Token 删除后：${redisTokenAfterDelete ? '存在' : '不存在'}`);
    
    // 从数据库恢复
    console.log('从数据库恢复 Token...');
    const recoveredToken = await authTokenDatabaseStorage.getToken();
    console.log(`数据库 Token: ${recoveredToken ? recoveredToken.access_token.substring(0, 50) + '...' : '无'}`);
    console.log(recoveredToken && recoveredToken.access_token === testToken ? '✅ 数据库 Token 完好' : '❌ 数据库 Token 丢失');
    
    // 同步回 Redis
    if (recoveredToken) {
      console.log('同步 Token 回 Redis...');
      await authTokenStorage.saveToken(recoveredToken.access_token);
      const redisTokenRecovered = await authTokenStorage.getToken();
      console.log(`Redis Token 恢复：${redisTokenRecovered ? '✅ 成功' : '❌ 失败'}`);
    }
    
    console.log('\n【测试 6】清理测试数据...');
    console.log('删除数据库中的测试 Token...');
    await authTokenDatabaseStorage.deleteToken();
    console.log('✅ 清理完成');
    
    console.log('\n========================================');
    console.log('✅ 所有测试完成');
    console.log('========================================\n');
    
    await db.shutdown();
    
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testDoubleStorage().catch(console.error);
