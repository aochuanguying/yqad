#!/usr/bin/env ts-node
/**
 * 从生产数据库查询小红书 Cookie
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env.production') });

async function getXiaohongshuCookie() {
  // 生产数据库配置
  const dbConfig = {
    host: '192.168.50.50',
    port: 3306,
    user: 'root',
    password: 'Wfw7539148@',
    database: 'yqad_prod_db',
  };

  console.log('📊 连接数据库...');
  console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   Database: ${dbConfig.database}`);
  console.log(`   User: ${dbConfig.user}`);

  let connection;

  try {
    // 创建数据库连接
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 查询小红书 Cookie
    const sql = 'SELECT xiaohongshu_cookie, xiaohongshu_enabled FROM network_post_config WHERE id = 1';
    const [rows]: any = await connection.query(sql);

    if (rows && rows.length > 0) {
      const row = rows[0];
      const cookie = row.xiaohongshu_cookie;
      const enabled = row.xiaohongshu_enabled;

      console.log('\n📋 查询结果:');
      console.log(`   启用状态：${enabled ? '✅ 已启用' : '❌ 未启用'}`);
      
      if (cookie && cookie.length > 0) {
        // 清理 Cookie：移除可能的多余内容
        const cleanCookie = cookie.split('\n')[0].trim();
        
        console.log(`   Cookie 长度：${cleanCookie.length} 字符`);
        console.log(`   Cookie 前 100 字符：${cleanCookie.substring(0, 100)}...`);
        
        // 提取关键字段
        const cookieDict: Record<string, string> = {};
        for (const item of cleanCookie.split(';')) {
          if (item.includes('=')) {
            const [key, ...valueParts] = item.split('=');
            const value = valueParts.join('=').trim();
            const trimmedKey = key.trim();
            cookieDict[trimmedKey] = value;
          }
        }

        console.log('\n🔑 关键字段:');
        console.log(`   a1: ${cookieDict['a1'] ? '✅ 存在' : '❌ 缺失'}`);
        console.log(`   web_session: ${cookieDict['web_session'] ? '✅ 存在' : '❌ 缺失'}`);
        console.log(`   id_token: ${cookieDict['id_token'] ? '✅ 存在' : '❌ 缺失'}`);
        console.log(`   webId: ${cookieDict['webId'] ? '✅ 存在' : '❌ 缺失'}`);

        // 输出完整 Cookie
        console.log('\n📝 完整 Cookie:');
        console.log('--- COPY START ---');
        console.log(cookie);
        console.log('--- COPY END ---');

        return cookie;
      } else {
        console.log('❌ 数据库中没有小红书 Cookie');
        return null;
      }
    } else {
      console.log('❌ 未找到配置记录 (id=1)');
      return null;
    }
  } catch (error: any) {
    console.error('❌ 数据库查询失败:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

// 执行
getXiaohongshuCookie()
  .then((cookie) => {
    if (cookie) {
      console.log('\n✅ 查询完成');
      process.exit(0);
    } else {
      console.log('\n❌ 未找到 Cookie');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ 程序异常:', error);
    process.exit(1);
  });
