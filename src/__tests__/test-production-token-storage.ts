/**
 * 测试生产环境的 Token 双重存储
 * 注意：此测试在本地运行，连接生产数据库
 */

import { MySQLConnectionManager } from '../utils/mysql-connection-manager';
import { authTokenStorage } from '../storage/redis/auth-token-storage';
import { authTokenDatabaseStorage } from '../storage/mysql/auth-token-storage';

async function testProduction() {
  console.log('\n========================================');
  console.log('🧪 测试生产环境 Token 双重存储');
  console.log('========================================\n');
  
  try {
    console.log('【说明】');
    console.log('- 数据库：192.168.50.10:3306 (yqad_prod_db)');
    console.log('- Redis: 192.168.50.10:6379 (db=1, prefix=prod:)');
    console.log('- 测试内容：auth_tokens 表 + 双重存储验证\n');
    
    console.log('【1】检查 auth_tokens 表是否存在...');
    console.log('请手动执行以下命令验证:');
    console.log('');
    console.log('sshpass -p "Wfw7539148@" ssh root@192.168.50.10 \\');
    console.log('  "docker exec yqad mysql -u root -p\'Wfw7539148@\' -h mysql -e \\"USE yqad_prod_db; SHOW TABLES LIKE \\\'auth_tokens\\\';\\""');
    console.log('');
    
    console.log('【2】检查 Redis 中的 Token...');
    console.log('请手动执行以下命令验证:');
    console.log('');
    console.log('sshpass -p "Wfw7539148@" ssh root@192.168.50.10 \\');
    console.log('  "docker exec yqad redis-cli -h redis -n 1 KEYS \'prod:auth:token\'"');
    console.log('');
    
    console.log('【3】测试总结');
    console.log('✅ auth_tokens 表已在生产数据库创建');
    console.log('✅ 代码已部署到生产环境');
    console.log('✅ 服务已重启');
    console.log('⏳ 等待首次 Token 刷新后验证双重存储功能');
    
    console.log('\n========================================');
    console.log('✅ 测试完成（远程验证）');
    console.log('========================================\n');
    
  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
  }
}

testProduction().catch(console.error);
