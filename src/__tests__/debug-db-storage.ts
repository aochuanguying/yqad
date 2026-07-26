/**
 * 调试数据库 Token 存储
 */

import { MySQLConnectionManager } from '../utils/mysql-connection-manager';
import { authTokenDatabaseStorage } from '../storage/mysql/auth-token-storage';

async function debugDBStorage() {
  console.log('\n========================================');
  console.log('📝 调试数据库 Token 存储');
  console.log('========================================\n');
  
  try {
    const db = MySQLConnectionManager.getInstance();
    await db.initialize();
    
    const testToken = 'debug_token_' + Date.now();
    const expiresAt = new Date(Date.now() + 83 * 3600 * 1000);
    
    console.log('【1】检查当前数据库状态...');
    const existing = await authTokenDatabaseStorage.getToken();
    console.log('现有 Token:', existing ? `ID=${existing.id}` : '无');
    
    console.log('\n【2】保存新 Token...');
    const saved = await authTokenDatabaseStorage.saveToken({
      access_token: testToken,
      expires_at: expiresAt,
      refreshed_at: new Date(),
      refresh_source: 'debug_test',
    });
    console.log('保存结果:', saved ? '成功' : '失败');
    
    console.log('\n【3】立即查询数据库...');
    const result: any = await db.execute(`
      SELECT id, access_token, refresh_source, expires_at
      FROM auth_tokens
      WHERE refresh_source = 'debug_test'
      ORDER BY refreshed_at DESC
      LIMIT 5
    `);
    console.log('查询结果:', JSON.stringify(result, null, 2));
    
    console.log('\n【4】通过 getToken() 读取...');
    const token = await authTokenDatabaseStorage.getToken();
    console.log('getToken 结果:', token ? `ID=${token.id}, token=${token.access_token.substring(0, 30)}...` : '无');
    
    console.log('\n【5】清理测试数据...');
    await db.execute(`DELETE FROM auth_tokens WHERE refresh_source = 'debug_test'`);
    console.log('✅ 清理完成');
    
    await db.shutdown();
    
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

debugDBStorage();
