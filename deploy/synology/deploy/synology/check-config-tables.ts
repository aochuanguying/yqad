#!/usr/bin/env ts-node
/**
 * 检查所有配置表的数据状态
 */

import { apiConfigStorage } from './src/storage/mysql/api-config-storage';
import { autojsApiStorage } from './src/storage/mysql/autojs-api-storage';
import { vehicleMonitorStorage } from './src/storage/mysql/vehicle-monitor-storage';
import { contentLimitsStorage } from './src/storage/mysql/content-limits-storage';
import { commentConfigStorage } from './src/storage/mysql/comment-config-storage';
import { aiProviderStorage } from './src/storage/mysql/ai-provider-storage';
import { BaseDAO } from './src/storage/mysql/dao/base-dao';

async function checkTables() {
  console.log('=== 检查配置表数据 ===\n');
  
  try {
    // 1. API 配置
    console.log('1. API 配置:');
    const apiConfig = await apiConfigStorage.getConfig();
    console.log(apiConfig ? JSON.stringify(apiConfig, null, 2) : '❌ 无数据');
    console.log();
    
    // 2. AutoJS API 配置
    console.log('2. AutoJS API 配置:');
    const autojsConfig = await autojsApiStorage.getConfig();
    console.log(autojsConfig ? JSON.stringify(autojsConfig, null, 2) : '❌ 无数据');
    console.log();
    
    // 3. 车辆监控配置
    console.log('3. 车辆监控配置:');
    const vehicleConfig = await vehicleMonitorStorage.getConfig();
    console.log(vehicleConfig ? JSON.stringify(vehicleConfig, null, 2) : '❌ 无数据');
    console.log();
    
    // 4. 内容长度配置
    console.log('4. 内容长度配置:');
    const contentLimitsConfig = await contentLimitsStorage.getConfig();
    console.log(contentLimitsConfig ? JSON.stringify(contentLimitsConfig, null, 2) : '❌ 无数据');
    console.log();
    
    // 5. 评论配置
    console.log('5. 评论配置:');
    const commentConfig = await commentConfigStorage.getConfig();
    console.log(commentConfig ? JSON.stringify(commentConfig, null, 2) : '❌ 无数据');
    console.log();
    
    // 6. AI Providers
    console.log('6. AI Providers:');
    const providers = await aiProviderStorage.getAllProviders();
    console.log(providers && providers.length > 0 ? `${providers.length} 个提供商` : '❌ 无数据');
    if (providers && providers.length > 0) {
      providers.forEach((p: any) => {
        console.log(`  - ${p.name}: ${p.model}`);
      });
    }
    console.log();
    
    // 检查表是否存在
    console.log('7. 检查所有配置表:');
    const tables = await (BaseDAO as any).query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'yqad_db' 
      AND table_name LIKE '%config%'
    `);
    console.log(`找到 ${tables.length} 个配置表:`);
    tables.forEach((t: any) => console.log(`  - ${t.table_name}`));
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    process.exit(0);
  }
}

checkTables();
