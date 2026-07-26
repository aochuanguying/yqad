/**
 * 模拟车辆异常并触发告警（简化版 - 直接触发告警）
 */

import { alertService } from './src/services/alert-service';
import { getLogger } from './src/utils/logger';

const logger = getLogger('simulate-alert');

async function simulateAlert() {
  try {
    console.log('=== 开始模拟车辆异常告警 ===\n');
    
    // 1. 初始化告警服务
    console.log('1. 初始化告警服务...');
    await alertService.init();
    console.log('   告警服务初始化完成\n');
    
    // 2. 模拟异常数据
    const anomalies = [
      '车门未关',
      '车辆未设防',
      '车辆移动 (150 米)',
      '电池电压过低 (11.2V)'
    ];
    
    // 3. 模拟车辆位置
    const location = {
      lat: 36.10772373923576,
      lng: 120.41258170164984,
      address: '山东省青岛市即墨区奥捷智行汽车'
    };
    
    console.log('2. 模拟异常数据:');
    anomalies.forEach((anomaly, i) => {
      console.log(`   ${i + 1}. ${anomaly}`);
    });
    console.log();
    
    console.log('3. 模拟车辆位置:');
    console.log(`   纬度：${location.lat}`);
    console.log(`   经度：${location.lng}`);
    console.log(`   地址：${location.address}`);
    console.log();
    
    // 4. 触发告警
    console.log('4. 触发告警通知...');
    const result = await alertService.triggerAlert(anomalies, location);
    
    // 5. 显示结果
    console.log('\n5. 告警结果:');
    console.log('   ─────────────────────────────');
    console.log(`   总体状态：${result.success ? '✅ 成功' : (result.skipped ? '⚠️ 跳过' : '❌ 失败')}`);
    
    if (result.skipped && result.skipReason) {
      console.log(`   跳过原因：${result.skipReason}`);
    }
    
    if (result.barkResult) {
      console.log(`   Bark 通知：${result.barkResult.success ? '✅ 成功' : '❌ 失败'}`);
      if (result.barkResult.message) {
        console.log(`     消息：${result.barkResult.message}`);
      }
      if (result.barkResult.error) {
        console.log(`     错误：${result.barkResult.error}`);
      }
    } else {
      console.log('   Bark 通知：⚠️ 未配置');
    }
    
    if (result.smsResult) {
      console.log(`   短信通知：${result.smsResult.success ? '✅ 成功' : '❌ 失败'}`);
      if (result.smsResult.message) {
        console.log(`     消息：${result.smsResult.message}`);
      }
      if (result.smsResult.error) {
        console.log(`     错误：${result.smsResult.error}`);
      }
    } else {
      console.log('   短信通知：⚠️ 未配置');
    }
    
    if (result.callResult) {
      console.log(`   电话通知：${result.callResult.success ? '✅ 成功' : '❌ 失败'}`);
      if (result.callResult.message) {
        console.log(`     消息：${result.callResult.message}`);
      }
      if (result.callResult.error) {
        console.log(`     错误：${result.callResult.error}`);
      }
    } else {
      console.log('   电话通知：⚠️ 未配置');
    }
    
    console.log('   ─────────────────────────────');
    
    // 6. 获取告警统计
    const stats = alertService.getAlertStats();
    console.log('\n6. 今日告警统计:');
    console.log(`   - 今日告警次数：${stats.todayCount}`);
    console.log(`   - 本周告警次数：${stats.weekCount}`);
    if (stats.topAnomalies.length > 0) {
      console.log('   - 常见异常类型:');
      stats.topAnomalies.forEach((item, i) => {
        console.log(`     ${i + 1}. ${item.type} (${item.count}次)`);
      });
    }
    
    console.log('\n=== 模拟完成 ===');
  } catch (error) {
    console.error('模拟异常失败:', error instanceof Error ? error.message : String(error));
    console.error(error);
  }
}

// 执行模拟
simulateAlert();
