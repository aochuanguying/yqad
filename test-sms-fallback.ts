/**
 * 测试 Bark 失败时短信兜底
 */

import axios from 'axios';

const PROD_URL = 'http://192.168.50.10:3080';
const API_TOKEN = 'api_token_1640a8b188784e52e08e11eb8dcab3a9fcea5a8d6b03e1235d6705938eed853a';

async function testSmsFallback() {
  try {
    console.log('=== 测试 Bark 失败时短信兜底 ===\n');
    
    // 临时修改 Bark 配置，使用无效的 key
    console.log('1. 临时设置无效的 Bark Key...');
    await axios.post(
      `${PROD_URL}/api/vehicle-monitor/config`,
      {
        barkKey: 'invalid_key_for_test'
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('   ✅ 已设置无效 Bark Key\n');
    
    // 触发告警
    console.log('2. 触发告警（Bark 应该失败，短信应该兜底）...\n');
    const response = await axios.post(
      `${PROD_URL}/api/vehicle-monitor/test-alert`,
      {
        anomalies: ['测试短信兜底'],
        lat: 36.1077,
        lng: 120.4126,
        address: '测试位��'
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const result = response.data.data;
    console.log('📊 告警结果:\n');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log(`   │ 总体状态：${result.success ? '✅ 成功' : (result.skipped ? '⚠️ 跳过' : '❌ 失败')}                          │`);
    
    if (result.barkResult) {
      const status = result.barkResult.success ? '✅ 成功' : '❌ 失败';
      console.log(`   │ 📱 Bark: ${status.padEnd(29)}│`);
      if (result.barkResult.error) {
        console.log(`   │   错误：${result.barkResult.error.substring(0, 40)}...`);
      }
    }
    
    if (result.smsResult) {
      const status = result.smsResult.success ? '✅ 成功' : '❌ 失败';
      console.log(`   │ 💬 短信：${status.padEnd(29)}│`);
      if (result.smsResult.message) {
        console.log(`   │   消息：${result.smsResult.message}`);
      }
    }
    
    if (result.callResult) {
      const status = result.callResult.success ? '✅ 成功' : '❌ 失败';
      console.log(`   │ 📞 电话：${status.padEnd(29)}│`);
    }
    
    console.log('   └─────────────────────────────────────────┘\n');
    
    // 恢复 Bark 配置
    console.log('3. 恢复 Bark 配置...');
    await axios.post(
      `${PROD_URL}/api/vehicle-monitor/config`,
      {
        barkKey: 'Asbu4fr2HjGAjKbHANNbLS'
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('   ✅ 已恢复 Bark Key\n');
    
    console.log('=== 测试完成 ===');
    
  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as any;
      console.error('   响应:', axiosError.response?.data);
    }
  }
}

testSmsFallback();
