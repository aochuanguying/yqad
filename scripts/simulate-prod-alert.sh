#!/bin/bash
# 生产服务器车辆异常告警模拟脚本
# 用法：在生产服务器上执行此脚本

echo "=== 生产服务器车辆异常告警模拟 ==="
echo ""

# 切换到项目目录
cd /opt/docker/yqad/app

# 创建测试脚本
cat > /tmp/simulate-prod-alert.ts << 'EOF'
import { vehicleMonitorStorage } from './src/storage/mysql/vehicle-monitor-storage';
import { telecomApiStorage } from './src/storage/mysql/telecom-api-storage';
import { mobileServiceConfigStorage } from './src/storage/mysql/mobile-service-config-storage';
import { alertService } from './src/services/alert-service';

async function simulateAlert() {
  try {
    console.log('=== 生产环境告警配置检查 ===\n');
    
    // 1. 读取配置
    console.log('1. 读取生产配置...');
    const vehicleConfig = await vehicleMonitorStorage.getConfig();
    const telecomConfig = await telecomApiStorage.getConfig();
    const serviceConfig = await mobileServiceConfigStorage.getConfig();
    
    console.log('\n2. 配置信息:');
    console.log('   车辆监控配置:');
    console.log('     - 启用状态:', vehicleConfig?.enabled ? '✅ 已启用' : '❌ 未启用');
    console.log('     - Bark Key:', vehicleConfig?.barkKey ? '✅ 已配置 (' + vehicleConfig?.barkKey?.substring(0, 8) + '...)' : '❌ 未配置');
    console.log('     - Bark Server:', vehicleConfig?.barkServer || '默认');
    console.log('     - 告警手机号:', vehicleConfig?.alertPhone || '❌ 未配置');
    
    console.log('\n   Telecom 配置:');
    console.log('     - 告警手机号:', telecomConfig?.alertPhone || '❌ 未配置');
    
    console.log('\n   移动服务配置:');
    console.log('     - API URL:', serviceConfig?.apiUrl || '❌ 未配置');
    console.log('     - API Token:', serviceConfig?.apiToken ? '✅ 已配置' : '❌ 未配置');
    console.log();
    
    // 2. 初始化告警服务
    console.log('3. 初始化告警服务...');
    await alertService.init();
    console.log('   ✅ 告警服务初始化完成\n');
    
    // 3. 模拟异常
    const anomalies = [
      '车门未关',
      '车辆未设防',
      '车辆移动 (150 米)',
      '电池电压过低 (11.2V)'
    ];
    
    const location = {
      lat: 36.10772373923576,
      lng: 120.41258170164984,
      address: '山东省青岛市即墨区奥捷智行汽车'
    };
    
    console.log('4. 模拟异常数据:');
    anomalies.forEach((anomaly, i) => {
      console.log(`   ${i + 1}. ${anomaly}`);
    });
    console.log('\n   位置:', `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
    console.log('   地址:', location.address);
    console.log();
    
    // 4. 触发告警
    console.log('5. 🚨 触发告警通知...\n');
    const result = await alertService.triggerAlert(anomalies, location);
    
    // 5. 显示结果
    console.log('\n6. 告警结果:');
    console.log('   ─────────────────────────────');
    console.log(`   总体状态：${result.success ? '✅ 成功' : (result.skipped ? '⚠️ 跳过' : '❌ 失败')}`);
    
    if (result.skipped && result.skipReason) {
      console.log(`   跳过原因：${result.skipReason}`);
    }
    
    if (result.barkResult) {
      console.log(`   📱 Bark: ${result.barkResult.success ? '✅ 成功' : '❌ 失败'}`);
      if (result.barkResult.message) console.log(`      ${result.barkResult.message}`);
      if (result.barkResult.error) console.log(`      ${result.barkResult.error}`);
    }
    
    if (result.smsResult) {
      console.log(`   💬 短信：${result.smsResult.success ? '✅ 成功' : '❌ 失败'}`);
      if (result.smsResult.message) console.log(`      ${result.smsResult.message}`);
      if (result.smsResult.error) console.log(`      ${result.smsResult.error}`);
    }
    
    if (result.callResult) {
      console.log(`   📞 电话：${result.callResult.success ? '✅ 成功' : '❌ 失败'}`);
      if (result.callResult.message) console.log(`      ${result.callResult.message}`);
      if (result.callResult.error) console.log(`      ${result.callResult.error}`);
    }
    
    console.log('   ─────────────────────────────\n');
    
    // 6. 告警统计
    const stats = alertService.getAlertStats();
    console.log('7. 告警统计:');
    console.log('   - 今日告警:', stats.todayCount);
    console.log('   - 本周告警:', stats.weekCount);
    if (stats.topAnomalies.length > 0) {
      console.log('   - 常见异常:');
      stats.topAnomalies.forEach((item, i) => {
        console.log(`     ${i + 1}. ${item.type} (${item.count}次)`);
      });
    }
    
    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
    console.error(error);
  }
}

simulateAlert();
EOF

# 执行测试脚本
echo "执行测试脚本..."
npx tsx /tmp/simulate-prod-alert.ts

# 清理临时文件
rm -f /tmp/simulate-prod-alert.ts

echo ""
echo "=== 测试完成 ==="
