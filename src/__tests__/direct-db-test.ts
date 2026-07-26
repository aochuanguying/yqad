/**
 * 直接测试数据库 Token 存储
 */

import { MySQLConnectionManager } from '../utils/mysql-connection-manager';

async function testDirectDB() {
  console.log('\n========================================');
  console.log('📝 直接测试数据库 Token 存储');
  console.log('========================================\n');
  
  try {
    const db = MySQLConnectionManager.getInstance();
    await db.initialize();
    
    const testToken = 'test_token_' + Date.now();
    const expiresAt = new Date(Date.now() + 83 * 3600 * 1000);
    
    console.log('【1】插入 Token...');
    await db.execute(`
      INSERT INTO auth_tokens 
      (access_token, expires_at, refreshed_at, refresh_source)
      VALUES (?, ?, ?, ?)
    `, [testToken, expiresAt, new Date(), 'test']);
    console.log('✅ 插入成功');
    
    console.log('\n【2】查询 Token...');
    const result: any = await db.execute(`
      SELECT id, access_token, refresh_source, expires_at
      FROM auth_tokens
      ORDER BY refreshed_at DESC
      LIMIT 5
    `);
    
    console.log('查询结果:', JSON.stringify(result, null, 2));
    
    console.log('\n【3】清理测试数据...');
    await db.execute(`DELETE FROM auth_tokens WHERE refresh_source = 'test'`);
    console.log('✅ 清理完成');
    
    await db.shutdown();
    
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

testDirectDB();
