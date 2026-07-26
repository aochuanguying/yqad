/**
 * 检查生产环境告警配置
 */

import { vehicleMonitorStorage } from './src/storage/mysql/vehicle-monitor-storage';
import { telecomApiStorage } from './src/storage/mysql/telecom-api-storage';
import { mobileServiceConfigStorage } from './src/storage/mysql/mobile-service-config-storage';

async function checkProdConfig() {
  try {
    console.log('=== 生产环境告警配置检查 ===\n');
    
    // 1. 读取车辆监控配置
    console.log('1. 车辆监控配置:');
    const vehicleConfig = await vehicleMonitorStorage.getConfig();
    if (vehicleConfig) {
      console.log('   - 启用状态:', vehicleConfig.enabled ? '✅ 已启用' : '❌ 未启用');
      console.log('   - Bark Key:', vehicleConfig.barkKey ? '✅ 已配置 (' + vehicleConfig.barkKey.substring(0, 8) + '...)' : '❌ 未配置');
      console.log('   - Bark Server:', vehicleConfig.barkServer || '默认');
      console.log('   - 告警手机号:', vehicleConfig.alertPhone || '❌ 未配置');
      console.log('   - 监控间隔:', vehicleConfig.intervalMinutes, '分钟');
      console.log('   - 快速监控间隔:', vehicleConfig.quickIntervalMinutes, '分钟');
      console.log('   - 安全距离:', vehicleConfig.safeDistanceMeters, '米');
      console.log('   - 移动阈值:', vehicleConfig.moveThresholdMeters, '米');
      console.log('   - 最低电压:', vehicleConfig.minBatteryVolt, 'V');
    } else {
      console.log('   ❌ 配置为空');
    }
    console.log();
    
    // 2. 读取 Telecom 配置
    console.log('2. Telecom 告警配置:');
    const telecomConfig = await telecomApiStorage.getConfig();
    if (telecomConfig) {
      console.log('   - 告警手机号:', telecomConfig.alertPhone || '❌ 未配置');
    } else {
      console.log('   ❌ 配置为空');
    }
    console.log();
    
    // 3. 读取移动服务配置
    console.log('3. 移动服务配置:');
    const serviceConfig = await mobileServiceConfigStorage.getConfig();
    if (serviceConfig) {
      console.log('   - API URL:', serviceConfig.apiUrl || '❌ 未配置');
      console.log('   - API Token:', serviceConfig.apiToken ? '✅ 已配置 (' + serviceConfig.apiToken.substring(0, 8) + '...)' : '❌ 未配置');
    } else {
      console.log('   ❌ 配置为空');
    }
    console.log();
    
    // 4. 总结
    console.log('4. 配置总结:');
    const hasBark = !!vehicleConfig?.barkKey;
    const hasSmsPhone = !!vehicleConfig?.alertPhone;
    const hasTelecomConfig = !!telecomConfig?.alertPhone && !!serviceConfig?.apiUrl && !!serviceConfig?.apiToken;
    
    console.log('   - Bark 推送:', hasBark ? '✅ 已配置' : '❌ 未配置');
    console.log('   - 短信/电话:', hasTelecomConfig ? '✅ 已配置' : '❌ 未配置');
    console.log('   - 告警手机号:', hasSmsPhone ? `✅ ${vehicleConfig?.alertPhone}` : '❌ 未配置');
    
    console.log('\n=== 检查完成 ===');
  } catch (error) {
    console.error('❌ 检查失败:', error instanceof Error ? error.message : String(error));
  }
}

checkProdConfig();
