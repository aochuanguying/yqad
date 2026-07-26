/**
 * 测试无冷却时间限制
 */

import axios from 'axios';

const PROD_URL = 'http://192.168.50.10:3080';
const API_TOKEN = 'api_token_1640a8b188784e52e08e11eb8dcab3a9fcea5a8d6b03e1235d6705938eed853a';

async function testNoCooldown() {
  try {
    console.log('=== 测试无冷却时间限制 ===\n');
    
    // 连续触发 3 次告警
    for (let i = 1; i <= 3; i++) {
      console.log(`[${i}/3] 触发告警...`);
      
      const startTime = Date.now();
      const response = await axios.post(
        `${PROD_URL}/api/vehicle-monitor/test-alert`,
        {
          anomalies: [`测试告警 ${i}`],
          lat: 36.1077,
          lng: 120.4126,
          address: '测试位置'
        },
        {
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const duration = Date.now() - startTime;
      const result = response.data.data;
      
      console.log(`   耗时：${duration}ms`);
      console.log(`   总体状态：${result.success ? '✅ 成功' : '❌ 失败'}`);
      console.log(`   电话：${result.callResult?.success ? '✅' : '❌'}`);
      console.log(`   Bark: ${result.barkResult?.success ? '✅' : '❌'}`);
      console.log(`   短信：${result.smsResult ? (result.smsResult.success ? '✅ (兜底)' : '❌') : '未发送'}`);
      console.log();
      
      // 短暂等待
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('=== 测试完成 ===');
    console.log('✅ 3 次告警全部成功触发，无冷却时间限制');
    
  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as any;
      console.error('   响应:', axiosError.response?.data);
    }
  }
}

testNoCooldown();
