/**
 * 调用生产服务器的测试告警接口
 */

import axios from 'axios';

const PROD_URL = 'http://192.168.50.10:3080';
const API_TOKEN = 'api_token_1640a8b188784e52e08e11eb8dcab3a9fcea5a8d6b03e1235d6705938eed853a';

async function testProdAlert() {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   生产服务器告警测试                                    ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    // 模拟异常数据
    const testData = {
      anomalies: [
        '车门未关',
        '车辆未设防',
        '车辆移动 (150 米)',
        '电池电压过低 (11.2V)'
      ],
      lat: 36.10772373923576,
      lng: 120.41258170164984,
      address: '山东省青岛市即墨区奥捷智行汽车'
    };
    
    console.log('📍 测试位置:', testData.address);
    console.log('📊 模拟异常:', testData.anomalies.length, '项');
    testData.anomalies.forEach((a, i) => console.log(`   ${i+1}. ${a}`));
    console.log();
    
    console.log('🚨 触发告警...\n');
    
    const response = await axios.post(
      `${PROD_URL}/api/vehicle-monitor/test-alert`,
      testData,
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const result = response.data;
    console.log('📊 告警结果:\n');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log(`   │ 总体状态：${result.data.success ? '✅ 成功' : (result.data.skipped ? '⚠️ 跳过' : '❌ 失败')}                          │`);
    
    if (result.data.skipped && result.data.skipReason) {
      console.log(`   │ 跳过原因：${result.data.skipReason.padEnd(28)}│`);
    }
    
    if (result.data.barkResult) {
      const status = result.data.barkResult.success ? '✅ 成功' : '❌ 失败';
      console.log(`   │ 📱 Bark: ${status.padEnd(29)}│`);
      if (result.data.barkResult.message) {
        console.log(`   │   消息：${result.data.barkResult.message}`);
      }
      if (result.data.barkResult.error) {
        console.log(`   │   错误：${result.data.barkResult.error}`);
      }
    }
    
    if (result.data.smsResult) {
      const status = result.data.smsResult.success ? '✅ 成功' : '❌ 失败';
      console.log(`   │ 💬 短信：${status.padEnd(29)}│`);
      if (result.data.smsResult.message) {
        console.log(`   │   消息：${result.data.smsResult.message}`);
      }
      if (result.data.smsResult.error) {
        console.log(`   │   错误：${result.data.smsResult.error}`);
      }
    }
    
    if (result.data.callResult) {
      const status = result.data.callResult.success ? '✅ 成功' : '❌ 失败';
      console.log(`   │ 📞 电话：${status.padEnd(29)}│`);
      if (result.data.callResult.message) {
        console.log(`   │   消息：${result.data.callResult.message}`);
      }
      if (result.data.callResult.error) {
        console.log(`   │   错误：${result.data.callResult.error}`);
      }
    }
    
    console.log('   └─────────────────────────────────────────┘\n');
    
    console.log('✅ 测试完成！\n');
    console.log('💡 请检查:');
    console.log('   1. 手机是否收到 Bark 推送通知');
    console.log('   2. 是否收到短信 (189****2532)');
    console.log('   3. 是否接到告警电话\n');
    
  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as any;
      console.error('\n   状态码:', axiosError.response?.status);
      console.error('   响应数据:', JSON.stringify(axiosError.response?.data, null, 2));
    }
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
}

testProdAlert();
