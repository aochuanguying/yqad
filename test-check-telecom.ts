/**
 * 检查 Telecom API 配置
 */

import axios from 'axios';

const PROD_URL = 'http://192.168.50.10:3080';
const API_TOKEN = 'api_token_1640a8b188784e52e08e11eb8dcab3a9fcea5a8d6b03e1235d6705938eed853a';

async function checkTelecomConfig() {
  try {
    console.log('=== 检查 Telecom API 配置 ===\n');
    
    // 尝试调用一个假设的配置查询接口（如果存在）
    console.log('查询配置...');
    
    // 或者直接测试发送短信
    console.log('\n测试发送短信...');
    const response = await axios.post(
      `${PROD_URL}/api/posts/mobile/send-sms`,
      {
        phone_number: '18953272532',
        content: '这是一条测试短信，用于验证 Telecom API 配置'
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('响应:', response.data);
  } catch (error: any) {
    console.error('错误:', error.response?.data || error.message);
    
    if (error.response?.data) {
      console.log('\n详细错误:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkTelecomConfig();
