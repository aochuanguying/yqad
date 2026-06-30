const mysql = require('mysql2/promise');

const NEW_COOKIE = 'abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; webBuild=6.25.2; loadts=1782736071761; websectiga=82e85efc5500b609ac1166aaf086ff8aa4261153a448ef0be5b17417e4512f28; sec_poison_id=daeae1e8-534d-4b1a-bad3-5301c63cfa04; acw_tc=0ad5432c17827360724663041e0735cc4691d423589f5fb55f5f18b907f659; web_session=040069b6d9aed466dced282d77384bc4c5c3f2; id_token=VjEAAOrzIKG5VPCCg5r/+ynItV5B3xXsEmSjcRqypU2A2DePg3hfvfNQHB6oV/3cPVDrVGwBVN9ruEZysRrbHz/9m/aC5tf3xufWwbK2gLcZ9+PU2dr6L5l72W+e+Ss6ExPLI6H1; unread={%22ub%22:%226a421727000000002103d009%22%2C%22ue%22:%226a32be09000000002103d4cc%22%2C%22uc%22:31}';

async function updateCookie() {
  console.log('📊 连接生产数据库...');
  
  const connection = await mysql.createConnection({
    host: '192.168.50.50',
    port: 3306,
    user: 'root',
    password: 'Wfw7539148@',
    database: 'yqad_prod_db'
  });
  
  try {
    console.log('✅ 数据库连接成功');
    
    // 更新 Cookie
    const sql = `
      UPDATE network_post_config 
      SET xiaohongshu_cookie = ?,
          xiaohongshu_enabled = 1,
          updated_at = NOW()
      WHERE id = 1
    `;
    
    const [result] = await connection.execute(sql, [NEW_COOKIE]);
    console.log(`✅ Cookie 更新成功！影响的行数：${result.affectedRows}`);
    
    // 验证更新
    const [rows] = await connection.execute(`
      SELECT id, xiaohongshu_enabled, LENGTH(xiaohongshu_cookie) as cookie_length, updated_at
      FROM network_post_config
      WHERE id = 1
    `);
    
    console.log('\n📋 验证结果:');
    console.log(JSON.stringify(rows, null, 2));
    
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('\n✅ 数据库连接已关闭');
  }
}

updateCookie()
  .then(() => {
    console.log('\n✅ 完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 程序异常:', error);
    process.exit(1);
  });
