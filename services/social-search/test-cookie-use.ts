import { cookieConfigStorage } from './src/infra/cookie-config-storage';
import { cookiePool } from './src/infra/cookie-pool';

async function testCookieUsage() {
  console.log('=== 测试 Cookie 使用记录 ===\n');

  // 初始化数据库连接
  await cookieConfigStorage['initPool']();

  // 获取所有启用的配置
  const configs = await cookieConfigStorage.getAllByPlatform('zhihu');
  console.log('知乎配置列表:');
  configs.forEach(c => {
    console.log(`  ID: ${c.id}, Label: ${c.label}, useCount: ${c.useCount}`);
  });

  // 初始化 Cookie 池
  await cookiePool.init();

  // 模拟获取 Cookie
  console.log('\n模拟获取 Cookie...');
  const cookie1 = cookiePool.get('zhihu');
  console.log(`第一次获取：${cookie1 ? cookie1.substring(0, 30) + '...' : 'null'}`);

  const cookie2 = cookiePool.get('zhihu');
  console.log(`第二次获取：${cookie2 ? cookie2.substring(0, 30) + '...' : 'null'}`);

  // 等待异步更新完成
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 重新查询数据库
  console.log('\n重新查询数据库:');
  const updatedConfigs = await cookieConfigStorage.getAllByPlatform('zhihu');
  updatedConfigs.forEach(c => {
    console.log(`  ID: ${c.id}, Label: ${c.label}, useCount: ${c.useCount}`);
  });

  process.exit(0);
}

testCookieUsage().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
