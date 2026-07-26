/**
 * 测试 Bark API
 */

import axios from 'axios';

const BARK_KEY = 'Asbu4fr2HjGAjKbHANNbLS';
const BARK_SERVER = 'https://api.day.app';

async function testBarkAPI() {
  console.log('=== Bark API 测试 ===\n');
  
  console.log('Bark Key:', BARK_KEY);
  console.log('Bark Server:', BARK_SERVER);
  console.log();
  
  // 测试 1: 使用 URL 路径包含 key 的方式
  console.log('测试 1: URL 路径包含 key (POST /{key}/push)');
  try {
    const response1 = await axios.post(`${BARK_SERVER}/${BARK_KEY}/push`, {
      title: '测试推送 1',
      body: '这是通过 URL 路径发送的测试消息',
      level: 'timeSensitive',
      sound: 'alarm',
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ 成功:', response1.data);
  } catch (error: any) {
    console.log('❌ 失败:', error.response?.data || error.message);
  }
  console.log();
  
  // 测试 2: 使用默认 URL，在 body 中包含 key
  console.log('测试 2: 在 body 中包含 key (POST /push + device_key)');
  try {
    const response2 = await axios.post(`${BARK_SERVER}/push`, {
      title: '测试推送 2',
      body: '这是通过在 body 中包含 key 发送的测试消息',
      device_key: BARK_KEY,
      level: 'timeSensitive',
      sound: 'alarm',
    }, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ 成功:', response2.data);
  } catch (error: any) {
    console.log('❌ 失败:', error.response?.data || error.message);
  }
  console.log();
  
  // 测试 3: 检查健康状态
  console.log('测试 3: 健康检查 (GET /health)');
  try {
    const response3 = await axios.get(`${BARK_SERVER}/health`, {
      timeout: 10000
    });
    console.log('✅ 健康状态:', response3.data);
  } catch (error: any) {
    console.log('❌ 失败:', error.response?.data || error.message);
  }
  console.log();
  
  console.log('=== 测试完成 ===');
}

testBarkAPI();
