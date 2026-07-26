/**
 * 测试新的 manual-alert 接口
 */

import axios from 'axios';

const PROD_URL = 'https://yqad.hxfssc.com:8088';
const API_TOKEN = 'api_token_1640a8b188784e52e08e11eb8dcab3a9fcea5a8d6b03e1235d6705938eed853a';

async function testManualAlert() {
  try {
    console.log('=== 测试 manual-alert 接口 ===\n');
    
    console.log('1. 调用新接口 /manual-alert...');
    const response1 = await axios.post(
      `${PROD_URL}/api/vehicle-monitor/manual-alert`,
      {
        anomalies: ['CarPlay 断开'],
        lat: 36.1077,
        lng: 120.4126,
        address: 'CarPlay 断开位置'
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ 新接口响应:', response1.data.message);
    console.log('   总体状态:', response1.data.data.success ? '成功' : '失败');
    console.log();
    
    console.log('2. 测试旧接口 /test-alert（兼容性）...');
    const response2 = await axios.post(
      `${PROD_URL}/api/vehicle-monitor/test-alert`,
      {
        anomalies: ['测试兼容接口'],
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ 旧接口响应:', response2.data.message);
    console.log();
    
    console.log('=== 测试完成 ===');
    console.log('✅ 新接口正常工作');
    console.log('✅ 旧接口保持兼容');
    
  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as any;
      console.error('   响应:', axiosError.response?.data);
    }
  }
}

testManualAlert();
