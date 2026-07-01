/**
 * 修复全局人设配置
 */

import { initializeMySQL, getMySQLConnectionManager } from '../src/storage/mysql';
import { globalPromptStorage } from '../src/storage/mysql/global-prompt-storage';

async function main() {
  console.log('修复全局人设配置...\n');
  
  // 初始化 MySQL
  await initializeMySQL();
  
  // 保存新的配置
  console.log('保存新的全局人设配置...');
  await globalPromptStorage.save({
    personalInfo: {
      carModel: '奥迪 Q5L',
      gender: '男',
      ageGroup: '30-40 岁',
    },
    styleDescription: '真实车主分享，语言朴实，注重实用性和性价比',
  });
  console.log('✓ 已保存新的全局人设配置\n');
  
  // 验证读取
  console.log('验证读取配置...');
  const prompt = await globalPromptStorage.get();
  if (prompt) {
    const personalInfo = typeof prompt.personal_info === 'string' 
      ? JSON.parse(prompt.personal_info) 
      : prompt.personal_info;
    
    console.log('读取到的配置:');
    console.log('  车型:', personalInfo.carModel);
    console.log('  性别:', personalInfo.gender);
    console.log('  年龄段:', personalInfo.ageGroup);
    console.log('  风格描述:', prompt.style_description);
  } else {
    console.log('❌ 读取失败');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('错误:', error);
    process.exit(1);
  });
