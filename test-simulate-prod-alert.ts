/**
 * 生产服务器车辆异常告警模拟（远程执行版本）
 * 
 * 使用说明：
 * 1. 将此文件复制到生产服务器：/opt/docker/yqad/app/test-simulate-alert.ts
 * 2. 在生产服务器上执行：npx tsx test-simulate-alert.ts
 */

import { vehicleMonitorStorage } from './src/storage/mysql/vehicle-monitor-storage';
import { telecomApiStorage } from './src/storage/mysql/telecom-api-storage';
import { mobileServiceConfigStorage } from './src/storage/mysql/mobile-service-config-storage';
import { alertService } from './src/services/alert-service';

async function simulateAlert() {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   生产环境车辆异常告警模拟                              ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    // 1. 读取配置
    console.log('📋 1. 读取生产配置...\n');
    const vehicleConfig = await vehicleMonitorStorage.getConfig();
    const telecomConfig = await telecomApiStorage.getConfig();
    const serviceConfig = await mobileServiceConfigStorage.getConfig();
    
    console.log('   【车辆监控配置】');
    console.log('     启用状态:', vehicleConfig?.enabled ? '✅ 已启用' : '⚠️ 未启用');
    console.log('     Bark Key:', vehicleConfig?.barkKey ? '✅ ' + vehicleConfig.barkKey.substring(0, 8) + '***' : '❌ 未配置');
    console.log('     Bark Server:', vehicleConfig?.barkServer || '默认服务器');
    console.log('     告警手机号:', vehicleConfig?.alertPhone || '❌ 未配置');
    
    console.log('\n   【Telecom 配置】');
    console.log('     告警手机号:', telecomConfig?.alertPhone || '❌ 未配置');
    
    console.log('\n   【移动服务配置】');
    console.log('     API URL:', serviceConfig?.apiUrl || '❌ 未配置');
    console.log('     API Token:', serviceConfig?.apiToken ? '✅ 已配置' : '❌ 未配置');
    console.log();
    
    // 2. 初始化告警服务
    console.log('🔧 2. 初始化告警服务...\n');
    await alertService.init();
    console.log('   ✅ 告警服务初始化完成\n');
    
    // 3. 模拟异常数据
    const simulatedAnomalies = [
      '车门未关',
      '车辆未设防',
      '车辆移动 (150 米)',
      '电池电压过低 (11.2V)'
    ];
    
    const simulatedLocation = {
      lat: 36.10772373923576,
      lng: 120.41258170164984,
      address: '山东省青岛市即墨区奥捷智行汽车'
    };
    
    console.log('⚠️ 3. 模拟异常数据:\n');
    console.log('   异常列表:');
    simulatedAnomalies.forEach((anomaly, i) => {
      console.log(`     ${i + 1}. ${anomaly}`);
    });
    console.log(`\n   车辆位置：${simulatedLocation.lat.toFixed(6)}, ${simulatedLocation.lng.toFixed(6)}`);
    console.log('   地址:', simulatedLocation.address);
    console.log();
    
    // 4. 触发告警
    console.log('🚨 4. 触发告警通知...\n');
    const result = await alertService.triggerAlert(simulatedAnomalies, simulatedLocation);
    
    // 5. 显示告警结果
    console.log('\n📊 5. 告警结果:\n');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log(`   │ 总体状态：${result.success ? '✅ 成功' : (result.skipped ? '⚠️ 跳过' : '❌ 失败')}                          │`);
    
    if (result.skipped && result.skipReason) {
      console.log(`   │ 跳过原因：${result.skipReason.padEnd(28)}│`);
    }
    
    if (result.barkResult) {
      const status = result.barkResult.success ? '✅ 成功' : '❌ 失败';
      console.log(`   │ 📱 Bark 推送：${status.padEnd(24)}│`);
      if (result.barkResult.message) {
        console.log(`   │   消息：${result.barkResult.message.substring(0, 30)}...`);
      }
      if (result.barkResult.error) {
        console.log(`   │   错误：${result.barkResult.error}`);
      }
    } else {
      console.log('   │ 📱 Bark 推送：⚠️ 未配置                        │');
    }
    
    if (result.smsResult) {
      const status = result.smsResult.success ? '✅ 成功' : '❌ 失败';
      console.log(`   │ 💬 短信通知：${status.padEnd(24)}│`);
      if (result.smsResult.message) {
        console.log(`   │   消息：${result.smsResult.message.substring(0, 30)}...`);
      }
      if (result.smsResult.error) {
        console.log(`   │   错误：${result.smsResult.error}`);
      }
    } else {
      console.log('   │ 💬 短信通知：⚠️ 未配置                          │');
    }
    
    if (result.callResult) {
      const status = result.callResult.success ? '✅ 成功' : '❌ 失败';
      console.log(`   │ 📞 电话通知：${status.padEnd(24)}│`);
      if (result.callResult.message) {
        console.log(`   │   消息：${result.callResult.message.substring(0, 30)}...`);
      }
      if (result.callResult.error) {
        console.log(`   │   错误：${result.callResult.error}`);
      }
    } else {
      console.log('   │ 📞 电话通知：⚠️ 未配置                          │');
    }
    
    console.log('   └─────────────────────────────────────────┘\n');
    
    // 6. 告警统计
    const stats = alertService.getAlertStats();
    console.log('📈 6. 告警统计:\n');
    console.log(`   今日告警次数：${stats.todayCount}`);
    console.log(`   本周告警次数：${stats.weekCount}`);
    
    if (stats.topAnomalies.length > 0) {
      console.log('\n   常见异常类型:');
      stats.topAnomalies.forEach((item, i) => {
        console.log(`     ${i + 1}. ${item.type} - ${item.count}次`);
      });
    }
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   测试完成 ✅                                          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
    console.error(error);
  }
}

simulateAlert();
