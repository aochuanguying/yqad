/**
 * 测试 Telecom API 连接
 */

import axios from 'axios';

const MOBILE_API_URL = 'https://yqad.hxfssc.com:8088';
const API_TOKEN = 'api_token_1640a8b188784e52e08e11eb8dcab3a9fcea5a8d6b03e1235d6705938eed853a';

async function testTelecomConnection() {
  console.log('=== 测试 Telecom API 连接 ===\n');
  console.log('API 地址:', MOBILE_API_URL);
  console.log();
  
  // 测试 1: 健康检查
  console.log('测试 1: 健康检查 (/health)');
  try {
    const response = await axios.get(`${MOBILE_API_URL}/health`, {
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });
    console.log('✅ 健康检查成功:', response.data);
  } catch (error: any) {
    console.log('❌ 健康检查失败:', error.code || error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   响应:', error.response.data);
    }
  }
  console.log();
  
  // 测试 2: 尝试发送短信
  console.log('测试 2: 发送短信 (/api/v1/sms/send)');
  try {
    const response = await axios.post(
      `${MOBILE_API_URL}/api/v1/sms/send`,
      {
        phone_number: '18953272532',
        message: '这是一条测试短信'
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ 短信发送成功:', response.data);
  } catch (error: any) {
    console.log('❌ 短信发送失败:', error.code || error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   响应:', JSON.stringify(error.response.data, null, 2));
    }
  }
  console.log();
  
  // 测试 3: 尝试拨打电话
  console.log('测试 3: 拨打电话 (/api/v1/call)');
  try {
    const response = await axios.post(
      `${MOBILE_API_URL}/api/v1/call`,
      {
        phone_number: '18953272532'
      },
      {
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ 电话拨打成功:', response.data);
  } catch (error: any) {
    console.log('❌ 电话拨打失败:', error.code || error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   响应:', JSON.stringify(error.response.data, null, 2));
    }
  }
  console.log();
  
  console.log('=== 测试完成 ===');
}

testTelecomConnection();
