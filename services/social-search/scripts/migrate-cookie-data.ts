/**
 * 从 network_post_config 迁移 Cookie 数据到 cookie_configs
 */

import mysql from 'mysql2/promise';

const PROD_DB = {
  host: '192.168.50.10',
  port: 3306,
  user: 'root',
  password: 'Wfw7539148@',
  database: 'yqad_prod_db',
};

async function main() {
  const conn = await mysql.createConnection(PROD_DB);
  
  try {
    await conn.beginTransaction();
    
    // 1. 获取 network_post_config 的最新数据
    const [npRows]: any = await conn.query(
      'SELECT * FROM network_post_config ORDER BY id DESC LIMIT 1'
    );
    
    if (npRows.length === 0) {
      console.log('❌ network_post_config 表中没有数据');
      await conn.rollback();
      return;
    }
    
    const np = npRows[0];
    console.log('📥 源数据 (network_post_config):');
    console.log(`   知乎 Cookie: ${np.zhihu_cookie ? np.zhihu_cookie.length : 0} 字符`);
    console.log(`   知乎 Access Secret: ${np.zhihu_access_secret ? np.zhihu_access_secret.length : 0} 字符`);
    console.log(`   小红书 Cookie: ${np.xiaohongshu_cookie ? np.xiaohongshu_cookie.length : 0} 字符`);
    
    // 2. 删除 cookie_configs 中的旧测试数据
    console.log('\n🗑️  删除 cookie_configs 中的旧数据...');
    await conn.query('DELETE FROM cookie_configs');
    
    // 3. 插入知乎配置
    if (np.zhihu_cookie && np.zhihu_cookie.length > 0) {
      const zhihuId = await conn.query(
        `INSERT INTO cookie_configs (platform, label, cookie, access_secret, enabled, priority, weight, 
          cookie_version, last_refresh_at, next_refresh_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          'zhihu',
          '网络发帖 - 知乎',
          np.zhihu_cookie,
          np.zhihu_access_secret || '',
          np.zhihu_enabled ? 1 : 0,
          0,
          10,
          np.zhihu_cookie_version || 1,
          np.zhihu_last_refresh_time || null,
          np.zhihu_next_refresh_time || null
        ]
      );
      console.log(`✅ 插入知乎配置，ID: ${(zhihuId as any).insertId}`);
    }
    
    // 4. 插入小红书配置
    if (np.xiaohongshu_cookie && np.xiaohongshu_cookie.length > 0) {
      const xhsId = await conn.query(
        `INSERT INTO cookie_configs (platform, label, cookie, enabled, priority, weight,
          cookie_version, last_refresh_at, next_refresh_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          'xiaohongshu',
          '网络发帖 - 小红书',
          np.xiaohongshu_cookie,
          np.xiaohongshu_enabled ? 1 : 0,
          0,
          10,
          np.xiaohongshu_cookie_version || 1,
          np.xiaohongshu_last_refresh_time || null,
          np.xiaohongshu_next_refresh_time || null
        ]
      );
      console.log(`✅ 插入小红书配置，ID: ${(xhsId as any).insertId}`);
    }
    
    // 5. 插入汽车之家配置（如果有 Cookie）
    if (np.autohome_cookie && np.autohome_cookie.length > 0) {
      const autohomeId = await conn.query(
        `INSERT INTO cookie_configs (platform, label, cookie, enabled, priority, weight,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          'autohome',
          '网络发帖 - 汽车之家',
          np.autohome_cookie,
          np.autohome_enabled ? 1 : 0,
          0,
          10
        ]
      );
      console.log(`✅ 插入汽车之家配置，ID: ${(autohomeId as any).insertId}`);
    }
    
    await conn.commit();
    
    // 6. 验证结果
    const [newRows]: any = await conn.query('SELECT id, platform, label, LENGTH(cookie) as cookie_length, enabled FROM cookie_configs ORDER BY id');
    console.log('\n📊 迁移后的 cookie_configs 数据:');
    console.table(newRows.map((r: any) => ({
      ID: r.id,
      Platform: r.platform,
      Label: r.label,
      CookieLength: r.cookie_length,
      Enabled: r.enabled ? 'Yes' : 'No'
    })));
    
    console.log('\n✅ 迁移完成！');
    
  } catch (err: any) {
    console.error('❌ 迁移失败:', err.message);
    await conn.rollback();
  } finally {
    await conn.end();
  }
}

main();
