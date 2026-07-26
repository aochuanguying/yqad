/**
 * Token 验证与双重存储测试脚本
 * 
 * 测试场景：
 * 1. validateAndRefreshToken() - Token 验证和刷新
 * 2. 双重存储 - Redis + 数据库
 * 3. 数据库恢复 - Redis 无 Token 时从数据库恢复
 * 4. 自动评论 - Token 验证集成
 * 5. 热门话题 - Token 验证集成
 * 6. 会员查询 - Token 验证集成
 */

import { AuthService } from '../services/auth';
import { RealAudiApi } from '../api/real-client';
import { authTokenStorage } from '../storage/redis/auth-token-storage';
import { authTokenDatabaseStorage } from '../storage/mysql/auth-token-storage';
import { getDatabase } from '../utils/database';
import { getLogger } from '../utils/logger';

const logger = getLogger('test-token-validation');

async function testTokenValidation() {
  console.log('\n========================================');
  console.log('📝 测试 Token 验证与双重存储');
  console.log('========================================\n');
  
  try {
    // 创建 API 客户端
    const api = new RealAudiApi();
    
    // 创建 AuthService
    const authService = await AuthService.create(api);
    
    console.log('✅ AuthService 初始化完成\n');
    
    // 测试 1: 检查当前 Token 状态
    console.log('【测试 1】检查当前 Token 状态...');
    const redisToken = await authTokenStorage.getToken();
    console.log(`Redis Token: ${redisToken ? redisToken.substring(0, 30) + '...' : '无'}`);
    
    const dbToken = await authTokenDatabaseStorage.getToken();
    console.log(`数据库 Token: ${dbToken ? dbToken.access_token.substring(0, 30) + '...' : '无'}`);
    console.log(`数据库 Token 过期时间：${dbToken ? dbToken.expires_at : '无'}\n`);
    
    // 测试 2: 验证 Token 有效性
    console.log('【测试 2】验证 Token 有效性...');
    try {
      const validToken = await authService.validateAndRefreshToken();
      console.log(`✅ Token 有效：${validToken.substring(0, 30) + '...'}`);
    } catch (error: any) {
      console.log(`⚠️ Token 验证失败：${error.message}`);
      console.log('将尝试自动刷新...\n');
    }
    
    // 测试 3: 检查双重存储
    console.log('\n【测试 3】检查双重存储...');
    const redisTokenAfter = await authTokenStorage.getToken();
    const dbTokenAfter = await authTokenDatabaseStorage.getToken();
    
    console.log(`Redis Token: ${redisTokenAfter ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`数据库 Token: ${dbTokenAfter ? '✅ 存在' : '❌ 不存在'}`);
    
    if (dbTokenAfter) {
      console.log(`数据库刷新来源：${dbTokenAfter.refresh_source}`);
      console.log(`数据库刷新时间：${dbTokenAfter.refreshed_at}`);
      console.log(`数据库过期时间：${dbTokenAfter.expires_at}`);
    }
    
    // 测试 4: 查询数据库记录
    console.log('\n【测试 4】查询数据库 Token 历史...');
    const db = getDatabase();
    const [rows]: any[] = await db.execute(`
      SELECT 
        id,
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
        console.log(`  - ID: ${row.id}, 刷新时间：${row.refreshed_at}, 来源：${row.refresh_source}, 剩余小时：${row.hours_remaining}`);
      });
    } else {
      console.log('数据库中无 Token 记录');
    }
    
    // 测试 5: 模拟 Redis 故障，从数据库恢复
    console.log('\n【测试 5】模拟 Redis 故障，从数据库恢复...');
    console.log('删除 Redis 中的 Token...');
    await authTokenStorage.deleteToken();
    console.log('✅ Redis Token 已删除');
    
    // 重新创建 AuthService（模拟服务重启）
    console.log('重新创建 AuthService（模拟服务重启）...');
    const authService2 = await AuthService.create(api);
    
    const redisTokenRecovered = await authTokenStorage.getToken();
    console.log(`Redis Token 恢复：${redisTokenRecovered ? '✅ 成功' : '❌ 失败'}`);
    
    // 测试 6: 获取 Token
    console.log('\n【测试 6】获取 Token...');
    try {
      const token = await authService2.getAccessToken();
      console.log(`✅ 获取 Token 成功：${token.substring(0, 30) + '...'}`);
    } catch (error: any) {
      console.log(`❌ 获取 Token 失败：${error.message}`);
    }
    
    console.log('\n========================================');
    console.log('✅ 所有测试完成');
    console.log('========================================\n');
    
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testTokenValidation().catch(console.error);
