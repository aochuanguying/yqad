/** 使用生产数据库的真实 Access Secret 测试知乎搜索 */
import * as mysql from 'mysql2/promise';

async function main() {
  console.log('='.repeat(80));
  console.log('使用生产数据库的真实 Access Secret 测试知乎');
  console.log('='.repeat(80));
  
  // 步骤 1: 从生产数据库读取 Access Secret
  console.log('\n📊 步骤 1: 连接生产数据库读取 Access Secret...');
  
  const prodConfig = {
    host: process.env.PROD_MYSQL_HOST || '192.168.50.50',
    user: process.env.PROD_MYSQL_USER || 'root',
    password: process.env.PROD_MYSQL_PASSWORD || '',
    database: process.env.PROD_MYSQL_DATABASE || 'yqad_prod_db',
  };
  
  console.log(`🔗 连接数据库：${prodConfig.host}/${prodConfig.database}`);
  
  let connection;
  try {
    connection = await mysql.createConnection(prodConfig);
    
    const [rows]: any = await connection.execute(
      'SELECT zhihu_access_secret, zhihu_enabled FROM network_post_config LIMIT 1'
    );
    
    if (rows && rows.length > 0) {
      const accessSecret = rows[0].zhihu_access_secret;
      const isEnabled = rows[0].zhihu_enabled;
      
      console.log('✅ 读取成功:');
      console.log(`   - Access Secret: ${accessSecret ? accessSecret.substring(0, 30) + '...' : '未配置'}`);
      console.log(`   - 启用状态：${isEnabled ? '是' : '否'}`);
      
      if (!accessSecret) {
        console.log('❌ Access Secret 为空');
        return;
      }
      
      // 设置环境变量
      process.env.ZHIHU_ACCESS_SECRET = accessSecret;
      console.log('\n✅ 已设置环境变量 ZHIHU_ACCESS_SECRET');
      
      // 步骤 2: 测试知乎 API 搜索
      console.log('\n' + '='.repeat(80));
      console.log('测试知乎 API 搜索（使用真实 Access Secret）');
      console.log('='.repeat(80));
      
      console.log("\n🔍 步骤 2: 搜索关键词 '奥迪 Q5L'...");
      
      const { ZhihuSearch } = await import('../src/services/internet-search/zhihu-search');
      const zhihu = new ZhihuSearch();
      
      const results = await zhihu.search(['奥迪 Q5L'], 5);
      
      console.log(`\n✅ 搜索成功，找到 ${results.length} 条结果`);
      
      // 显示搜索结果
      for (let i = 0; i < Math.min(results.length, 3); i++) {
        const result = results[i];
        console.log(`\n  ${i + 1}. ${result.title}`);
        console.log(`     URL: ${result.url}`);
        console.log(`     内容长度：${result.content?.length || 0} 字符`);
        console.log(`     图片数量：${result.images?.length || 0} 张`);
      }
      
      // 步骤 3: 保存第一篇帖子详情
      if (results.length > 0) {
        console.log('\n📝 步骤 3: 保存第一篇帖子详情...');
        await saveResultToFile(results[0]);
      }
      
    } else {
      console.log('❌ 数据库中没有配置记录');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error instanceof Error ? error.message : error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function saveResultToFile(result: any) {
  const fs = require('fs');
  const path = require('path');
  
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
  const safeTitle = result.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, '').substring(0, 50);
  
  // 保存文本
  const textFile = path.join(outputDir, `${timestamp}_${safeTitle}.txt`);
  let content = '='.repeat(80) + '\n';
  content += '知乎帖子详情 - 奥迪 Q5L (使用真实 Access Secret)\n';
  content += '='.repeat(80) + '\n\n';
  content += `标题：${result.title}\n`;
  content += `URL: ${result.url}\n`;
  content += `提取时间：${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n`;
  content += `内容长度：${result.content?.length || 0} 字符\n`;
  content += `图片数量：${result.images?.length || 0} 张\n\n`;
  content += '='.repeat(80) + '\n\n';
  content += '【正文内容】\n\n';
  content += result.content || '';
  content += '\n\n' + '='.repeat(80) + '\n\n';
  content += '【图片列表】\n\n';
  
  if (result.images && result.images.length > 0) {
    result.images.forEach((img: string, i: number) => {
      content += `${i + 1}. ${img}\n`;
    });
  }
  
  fs.writeFileSync(textFile, content, 'utf-8');
  console.log(`✅ 文本已保存到：${textFile}`);
  
  // 下载图片
  if (result.images && result.images.length > 0) {
    console.log(`\n🖼️  正在下载 ${result.images.length} 张图片...`);
    
    const imgDir = path.join(outputDir, `${timestamp}_${safeTitle}_images`);
    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir, { recursive: true });
    }
    
    const https = require('https');
    const http = require('http');
    
    for (let i = 0; i < result.images.length; i++) {
      const imgUrl = result.images[i];
      const imgName = imgUrl.split('/').pop();
      const imgPath = path.join(imgDir, `${(i + 1).toString().padStart(2, '0')}_${imgName}`);
      
      await new Promise((resolve) => {
        const client = imgUrl.startsWith('https') ? https : http;
        client.get(imgUrl, (res: any) => {
          const file = fs.createWriteStream(imgPath);
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`  ✅ 图片 ${i + 1}/${result.images.length}: ${imgName}`);
            resolve(true);
          });
        }).on('error', (err: Error) => {
          console.log(`  ❌ 下载失败：${err.message}`);
          resolve(true);
        });
      });
    }
    
    console.log(`✅ 图片已保存到：${imgDir}`);
  }
}

main();
