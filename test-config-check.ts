#!/usr/bin/env node
/**
 * 配置检查测试
 */

import { loadConfig } from './src/utils/config';

const config = loadConfig();

console.log('=== 配置检查 ===\n');
console.log('internetSearch 配置:', JSON.stringify(config.internetSearch, null, 2));
console.log('\nCookie 长度:', config.internetSearch?.xiaohongshuCookie?.length || 0);
console.log('Cookie 前 50 字符:', config.internetSearch?.xiaohongshuCookie?.substring(0, 50) || '无');
