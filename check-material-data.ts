import mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

async function check() {
  const configPath = path.resolve(process.cwd(), 'config/default.yaml');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const config = yaml.parse(configContent) as any;
  const mysqlConfig = config.mysql.production;
  
  const conn = await mysql.createConnection({
    host: mysqlConfig.host,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
  });
  
  console.log('=== 检查 material_records 表数据 ===\n');
  
  // 检查 matched_keywords
  console.log('1. matched_keywords 示例:');
  const [keywordsRows]: any = await conn.query(`
    SELECT id, matched_keywords, TYPEOF(matched_keywords) as type
    FROM material_records 
    WHERE matched_keywords IS NOT NULL 
    LIMIT 5
  `);
  console.log(JSON.stringify(keywordsRows, null, 2));
  
  // 检查 associated_posts
  console.log('\n2. associated_posts 示例:');
  const [postsRows]: any = await conn.query(`
    SELECT id, associated_posts, TYPEOF(associated_posts) as type
    FROM material_records 
    WHERE associated_posts IS NOT NULL 
    LIMIT 5
  `);
  console.log(JSON.stringify(postsRows, null, 2));
  
  await conn.end();
}

check().catch(console.error);
