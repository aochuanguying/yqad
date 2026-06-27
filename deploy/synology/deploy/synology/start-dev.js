#!/usr/bin/env node
/**
 * 开发环境启动脚本（绕过 TypeScript 编译）
 * 直接加载 .env 并启动应用
 */

require('dotenv').config();

console.log('='.repeat(60));
console.log('🚀 启动应用（开发模式）');
console.log('='.repeat(60));
console.log();
console.log('📊 数据库配置:');
console.log(`   MySQL: ${process.env.MYSQL_HOST || '10.6.0.5'}:${process.env.MYSQL_PORT || '3306'}`);
console.log(`   Redis: ${process.env.REDIS_HOST || '10.6.0.5'}:${process.env.REDIS_PORT || '6379'}`);
console.log(`   ChromaDB: ${process.env.CHROMADB_URL || 'http://10.6.0.5:8000'}`);
console.log();

// 设置环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// 加载并运行主程序
try {
  require('./src/index.ts');
  console.log('✅ 应用启动成功！');
} catch (error) {
  console.error('❌ 应用启动失败:', error.message);
  console.error();
  console.error('提示：TypeScript 文件需要使用 ts-node 运行');
  console.error('请执行：npm run dev');
  process.exit(1);
}
