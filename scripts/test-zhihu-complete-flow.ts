/** 
 * 完整的知乎内容获取流程
 * 1. 从生产数据库读取 Access Secret
 * 2. 使用知乎 API 搜索帖子列表
 * 3. 使用 Playwright 获取第一篇帖子的详情（包括图片）
 */
import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';

async function main() {
  console.log('='.repeat(80));
  console.log('知乎完整内容获取流程');
  console.log('='.repeat(80));
  
  // 步骤 1: 从生产数据库读取 Access Secret
  console.log('\n📊 步骤 1: 连接生产数据库读取 Access Secret...');
  
  const prodConfig = {
    host: process.env.PROD_MYSQL_HOST || '192.168.50.50',
    user: process.env.PROD_MYSQL_USER || 'root',
    password: process.env.PROD_MYSQL_PASSWORD || '',
    database: process.env.PROD_MYSQL_DATABASE || 'yqad_prod_db',
  };
  
  let connection;
  let accessSecret: string | undefined;
  
  try {
    connection = await mysql.createConnection(prodConfig);
    
    const [rows]: any = await connection.execute(
      'SELECT zhihu_access_secret, zhihu_enabled FROM network_post_config LIMIT 1'
    );
    
    if (rows && rows.length > 0) {
      accessSecret = rows[0].zhihu_access_secret;
      const isEnabled = rows[0].zhihu_enabled;
      
      console.log('✅ 读取成功:');
      console.log(`   - Access Secret: ${accessSecret ? accessSecret.substring(0, 30) + '...' : '未配置'}`);
      console.log(`   - 启用状态：${isEnabled ? '是' : '否'}`);
      
      if (!accessSecret) {
        console.log('❌ Access Secret 为空，终止流程');
        return;
      }
    } else {
      console.log('❌ 数据库中没有配置记录');
      return;
    }
    
  } catch (error) {
    console.error('❌ 数据库连接失败:', error instanceof Error ? error.message : error);
    return;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
  
  // 步骤 2: 使用知乎 API 搜索帖子
  console.log('\n🔍 步骤 2: 使用知乎 API 搜索 "奥迪 Q5L"...');
  
  // 设置环境变量（在 import 之前）
  process.env.ZHIHU_ACCESS_SECRET = accessSecret;
  
  const { ZhihuSearch } = await import('../src/services/internet-search/zhihu-search');
  const zhihu = new ZhihuSearch();
  
  const searchResults = await zhihu.search(['奥迪 Q5L'], 5);
  
  console.log(`✅ 搜索成功，找到 ${searchResults.length} 条结果`);
  
  // 显示搜索结果
  console.log('\n📋 帖子列表:');
  for (let i = 0; i < Math.min(searchResults.length, 5); i++) {
    const result = searchResults[i];
    console.log(`\n  ${i + 1}. ${result.title}`);
    console.log(`     URL: ${result.url}`);
    console.log(`     内容长度：${result.content?.length || 0} 字符`);
    console.log(`     图片数量：${result.images?.length || 0} 张`);
  }
  
  // 步骤 3: 获取第一篇帖子的详情（使用 Playwright）
  if (searchResults.length > 0) {
    const firstResult = searchResults[0];
    console.log('\n📝 步骤 3: 使用 Playwright 获取第一篇帖子详情...');
    console.log(`目标 URL: ${firstResult.url}`);
    console.log('-'.repeat(80));
    
    // 调用 Python 脚本获取详情
    const detail = await fetchPostDetailWithPlaywright(firstResult.url);
    
    // 步骤 4: 显示详情
    console.log('\n' + '='.repeat(80));
    console.log('📊 帖子详情');
    console.log('='.repeat(80));
    console.log(`标题：${detail.title}`);
    console.log(`内容长度：${detail.content.length} 字符`);
    console.log(`图片数量：${detail.images.length} 张`);
    
    if (detail.images.length > 0) {
      console.log('\n图片列表:');
      detail.images.forEach((img, i) => {
        console.log(`  ${i + 1}. ${img}`);
      });
    }
    
    // 步骤 5: 保存到文件
    console.log('\n💾 步骤 5: 保存结果到文件...');
    await saveResultToFile(firstResult.title, detail.content, detail.images, firstResult.url);
    
  } else {
    console.log('\n❌ 搜索结果为空');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 流程完成!');
  console.log('='.repeat(80));
}

/**
 * 使用 Playwright 获取帖子详情
 */
async function fetchPostDetailWithPlaywright(url: string): Promise<{
  title: string;
  content: string;
  images: string[];
}> {
  const { spawn } = require('child_process');
  
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'test_zhihu_single.py');
    const pyProcess = spawn('python3', [scriptPath, url]);
    
    let output = '';
    let errorOutput = '';
    
    pyProcess.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });
    
    pyProcess.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });
    
    pyProcess.on('close', (code: number) => {
      if (code !== 0) {
        console.log(`⚠️ Python 脚本退出码：${code}`);
        console.log(`错误输出：${errorOutput}`);
      }
      
      // 解析 JSON 输出
      try {
        // 找到最后一行 JSON
        const lines = output.split('\n');
        let jsonStart = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].trim().startsWith('{')) {
            jsonStart = i;
            break;
          }
        }
        
        if (jsonStart >= 0) {
          const jsonStr = lines.slice(jsonStart).join('\n');
          const result = JSON.parse(jsonStr);
          
          resolve({
            title: result.title || '',
            content: result.content || '',
            images: result.images || [],
          });
        } else {
          throw new Error('未找到 JSON 输出');
        }
      } catch (error) {
        console.log('⚠️ 解析 JSON 失败，使用 fallback');
        resolve({
          title: '解析失败',
          content: output,
          images: [],
        });
      }
    });
    
    // 超时处理
    setTimeout(() => {
      pyProcess.kill();
      resolve({
        title: '超时',
        content: '',
        images: [],
      });
    }, 60000); // 60 秒超时
  });
}

/**
 * 保存结果到文件
 */
async function saveResultToFile(
  title: string,
  content: string,
  images: string[],
  url: string
) {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
  const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\-_]/g, '').substring(0, 50);
  
  // 保存文本
  const textFile = path.join(outputDir, `${timestamp}_${safeTitle}.txt`);
  let fileContent = '='.repeat(80) + '\n';
  fileContent += '知乎帖子详情 - 奥迪 Q5L (完整流程)\n';
  fileContent += '='.repeat(80) + '\n\n';
  fileContent += `标题：${title}\n`;
  fileContent += `URL: ${url}\n`;
  fileContent += `提取时间：${new Date().toISOString().replace('T', ' ').substring(0, 19)}\n`;
  fileContent += `内容长度：${content.length} 字符\n`;
  fileContent += `图片数量：${images.length} 张\n\n`;
  fileContent += '='.repeat(80) + '\n\n';
  fileContent += '【正文内容】\n\n';
  fileContent += content;
  fileContent += '\n\n' + '='.repeat(80) + '\n\n';
  fileContent += '【图片列表】\n\n';
  
  if (images.length > 0) {
    images.forEach((img, i) => {
      fileContent += `${i + 1}. ${img}\n`;
    });
  } else {
    fileContent += '（无图片）\n';
  }
  
  fs.writeFileSync(textFile, fileContent, 'utf-8');
  console.log(`✅ 文本已保存到：${textFile}`);
  
  // 下载图片
  if (images.length > 0) {
    console.log(`\n🖼️  正在下载 ${images.length} 张图片...`);
    
    const imgDir = path.join(outputDir, `${timestamp}_${safeTitle}_images`);
    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir, { recursive: true });
    }
    
    for (let i = 0; i < images.length; i++) {
      const imgUrl = images[i];
      const imgName = imgUrl.split('/').pop();
      const imgPath = path.join(imgDir, `${(i + 1).toString().padStart(2, '0')}_${imgName}`);
      
      await downloadImage(imgUrl, imgPath);
    }
    
    console.log(`✅ 图片已保存到：${imgDir}`);
  }
}

/**
 * 下载图片
 */
async function downloadImage(url: string, savePath: string): Promise<void> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res: any) => {
      if (res.statusCode !== 200) {
        console.log(`  ❌ 下载失败：HTTP ${res.statusCode}`);
        resolve();
        return;
      }
      
      const file = fs.createWriteStream(savePath);
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`  ✅ 图片：${path.basename(savePath)}`);
        resolve();
      });
    }).on('error', (err: Error) => {
      console.log(`  ❌ 下载失败：${err.message}`);
      resolve();
    });
  });
}

main();
