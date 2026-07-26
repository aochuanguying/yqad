/**
 * 模拟车辆异常并触发告警（通过外部接口）
 * 
 * 此脚本会：
 * 1. 调用车辆监控外部接口获取真实数据
 * 2. 如果车辆状态正常，模拟异常数据并触发告警
 * 3. 显示告警结果
 */

import axios from 'axios';
import { alertService } from './src/services/alert-service';

const API_TOKEN = 'api_token_1640a8b188784e52e08e11eb8dcab3a9fcea5a8d6b03e1235d6705938eed853a';
const BASE_URL = 'http://localhost:3000';

async function simulateAlert() {
  try {
    console.log('=== 开始模拟车辆异常告警 ===\n');
    
    // 1. 初始化告警服务
    console.log('1. 初始化告警服务...');
    await alertService.init();
    console.log('   ✅ 告警服务初始化完成\n');
    
    // 2. 调用外部接口获取车辆状态
    console.log('2. 获取车辆状态...');
    const response = await axios.get(`${BASE_URL}/api/vehicle-monitor/status/external`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      }
    });
    
    const vehicleData = response.data;
    console.log('   接口响应:', vehicleData.code);
    
    if (vehicleData.code !== 'SUCCESS') {
      console.log('   ❌ 获取车辆状态失败:', vehicleData.message);
      return;
    }
    
    const data = vehicleData.data;
    console.log('   - 在线状态:', data.isOnline ? '在线' : '离线');
    console.log('   - 异常状态:', data.isAnomaly ? '有异常' : '正常');
    if (data.anomalies && data.anomalies.length > 0) {
      console.log('   - 异常列表:', data.anomalies.join(', '));
    }
    console.log('   - 电池电压:', data.obd?.batteryVolt, 'V');
    console.log('   - 车门状态:', data.obd?.anyDoorOpen ? '未关' : '已关');
    console.log('   - 设防状态:', data.obd?.isDefence ? '已设防' : '未设防');
    console.log();
    
    // 3. 如果车辆正常，模拟异常
    if (!data.isAnomaly) {
      console.log('3. 车辆状态正常，模拟异常场景...');
      
      // 模拟多种异常
      const simulatedAnomalies = [
        '车门未关',
        '车辆未设防',
        '车辆移动 (150 米)',
        '电池电压过低 (11.2V)'
      ];
      
      console.log('   模拟异常:');
      simulatedAnomalies.forEach((anomaly, i) => {
        console.log(`      ${i + 1}. ${anomaly}`);
      });
      
      // 使用车辆的实际位置
      const location = data.location ? {
        lat: data.location.lat,
        lng: data.location.lng,
        address: '山东省青岛市即墨区'
      } : undefined;
      
      console.log('\n   车辆位置:', location ? `${location.lat}, ${location.lng}` : '未知');
      console.log();
      
      // 4. 触发告警
      console.log('4. 触发告警通知...');
      const result = await alertService.triggerAlert(simulatedAnomalies, location);
      
      // 5. 显示告警结果
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
      
      // 6. 显示告警统计
      const stats = alertService.getAlertStats();
      console.log('\n6. 告警统计:');
      console.log(`   - 今日告警次数：${stats.todayCount}`);
      console.log(`   - 本周告警次数：${stats.weekCount}`);
      if (stats.topAnomalies.length > 0) {
        console.log('   - 常见异常类型:');
        stats.topAnomalies.forEach((item, i) => {
          console.log(`     ${i + 1}. ${item.type} (${item.count}次)`);
        });
      }
    } else {
      console.log('3. 车辆已有异常，无需模拟');
      console.log('   异常列表:', data.anomalies.join(', '));
      console.log('\n   ℹ️ 车辆已触发异常，告警应该已经发送');
    }
    
    console.log('\n=== 模拟完成 ===');
  } catch (error) {
    console.error('❌ 模拟失败:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error(error.stack);
    }
  }
}

// 执行模拟
simulateAlert();
