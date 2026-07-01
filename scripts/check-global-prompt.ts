/**
 * 检查全局人设配置
 */

import { initializeMySQL, getMySQLConnectionManager } from '../src/storage/mysql';
import { globalPromptStorage } from '../src/storage/mysql/global-prompt-storage';

async function main() {
  console.log('检查全局人设配置...\n');
  
  // 初始化 MySQL
  await initializeMySQL();
  
  // 直接查询数据库
  const manager = getMySQLConnectionManager();
  const connection = await manager.getConnection();
  
  try {
    const [rows]: any = await connection.execute('SELECT * FROM global_prompts');
    
    if (Array.isArray(rows) && rows.length > 0) {
      console.log('找到全局人设配置:');
      console.log(JSON.stringify(rows[0], null, 2));
      
      // 尝试解析 personal_info
      if (rows[0].personal_info) {
        try {
          const parsed = typeof rows[0].personal_info === 'string' 
            ? JSON.parse(rows[0].personal_info) 
            : rows[0].personal_info;
          console.log('\n解析后的 personal_info:');
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e: any) {
          console.log('\n解析 personal_info 失败:', e.message);
        }
      }
    } else {
      console.log('没有找到全局人设配置');
    }
    
    // 使用 storage 读取
    console.log('\n使用 globalPromptStorage.get() 读取:');
    const prompt = await globalPromptStorage.get();
    if (prompt) {
      console.log(JSON.stringify(prompt, null, 2));
    } else {
      console.log('返回 null');
    }
    
  } finally {
    await connection.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('错误:', error);
    process.exit(1);
  });
