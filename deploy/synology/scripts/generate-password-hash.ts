#!/usr/bin/env ts-node
/**
 * 密码哈希生成脚本
 * 
 * 使用方法：
 * npm run generate-password-hash
 * 
 * 或在命令行直接运行：
 * npx ts-node scripts/generate-password-hash.ts
 */

import * as bcrypt from 'bcryptjs';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function getPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (password) => {
      resolve(password);
    });
  });
}

async function getPasswordConfirm(): Promise<string> {
  return new Promise((resolve) => {
    rl.question('请再次输入密码确认：', (password) => {
      resolve(password);
    });
  });
}

async function main() {
  console.log('=== 密码哈希生成工具 ===\n');
  console.log('此工具用于生成 bcrypt 密码哈希，用于 Web 管理界面的管理员账号配置。\n');
  
  const password = await getPassword('请输入密码：');
  
  if (password.length < 8) {
    console.log('\n❌ 错误：密码长度至少为 8 位！');
    rl.close();
    return;
  }
  
  const confirmPassword = await getPasswordConfirm();
  
  if (password !== confirmPassword) {
    console.log('\n❌ 错误：两次输入的密码不一致！');
    rl.close();
    return;
  }
  
  console.log('\n正在生成密码哈希...');
  
  try {
    // 使用 bcrypt 生成密码哈希，cost factor 设为 10
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    
    console.log('\n✅ 密码哈希生成成功！\n');
    console.log('请将以下哈希值复制到配置文件中：\n');
    console.log('='.repeat(80));
    console.log(`passwordHash: ${hash}`);
    console.log('='.repeat(80));
    console.log('\n配置示例（config/default.yaml 或 config/local.yaml）：\n');
    console.log('web:');
    console.log('  auth:');
    console.log('    enabled: true');
    console.log('    username: admin');
    console.log(`    passwordHash: ${hash}`);
    console.log('    sessionSecret: your-secret-key-here');
    console.log('    sessionMaxAge: 86400000\n');
    
    console.log('或使用环境变量：');
    console.log('  WEB_AUTH_USERNAME=admin');
    console.log(`  WEB_AUTH_PASSWORD_HASH=${hash}`);
    console.log('  WEB_AUTH_SESSION_SECRET=your-secret-key-here\n');
    
    console.log('⚠️  重要提示：');
    console.log('  1. 请妥善保管此哈希值，不要泄露给他人');
    console.log('  2. 生产环境建议使用环境变量而非配置文件');
    console.log('  3. 配置文件权限应设置为 600（仅所有者可读写）\n');
  } catch (error: any) {
    console.error('\n❌ 生成失败：', error.message);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
