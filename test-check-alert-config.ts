/**
 * 检查告警配置状态
 */

import { alertService } from './src/services/alert-service';
import { vehicleMonitorStorage } from './src/storage/mysql/vehicle-monitor-storage';
import { telecomApiStorage } from './src/storage/mysql/telecom-api-storage';
import { mobileServiceConfigStorage } from './src/storage/mysql/mobile-service-config-storage';

async function checkAlertConfig() {
  try {
    console.log('=== 告警配置检查 ===\n');
    
    // 1. 读取车辆监控配置
    console.log('1. 车辆监控配置:');
    const vehicleConfig = await vehicleMonitorStorage.getConfig();
    if (vehicleConfig) {
      console.log('   - 启用状态:', vehicleConfig.enabled ? '已启用' : '未启用');
      console.log('   - Bark Key:', vehicleConfig.barkKey ? '已配置' : '未配置');
      console.log('   - Bark Server:', vehicleConfig.barkServer || '默认');
      console.log('   - 告警手机号:', vehicleConfig.alertPhone || '未配置');
      console.log('   - 监控间隔:', vehicleConfig.intervalMinutes, '分钟');
    } else {
      console.log('   ⚠️ 配置为空');
    }
    console.log();
    
    // 2. 读取 Telecom 配置
    console.log('2. Telecom 配置:');
    const telecomConfig = await telecomApiStorage.getConfig();
    if (telecomConfig) {
      console.log('   - 告警手机号:', telecomConfig.alertPhone || '未配置');
    } else {
      console.log('   ⚠️ 配置为空');
    }
    console.log();
    
    // 3. 读取移动服务配置
    console.log('3. 移动服务配置:');
    const serviceConfig = await mobileServiceConfigStorage.getConfig();
    if (serviceConfig) {
      console.log('   - API URL:', serviceConfig.apiUrl || '未配置');
      console.log('   - API Token:', serviceConfig.apiToken ? '已配置' : '未配置');
    } else {
      console.log('   ⚠️ 配置为空');
    }
    console.log();
    
    // 4. 初始化告警服务并检查状态
    console.log('4. 告警服务状态:');
    await alertService.init();
    const isConfigured = alertService.isConfigured();
    console.log('   - Telecom 告警:', isConfigured ? '✅ 已配置' : '❌ 未配置');
    
    const hasBark = vehicleConfig?.barkKey ? true : false;
    console.log('   - Bark 告警:', hasBark ? '✅ 已配置' : '❌ 未配置');
    console.log();
    
    // 5. 建议
    console.log('5. 配置建议:');
    if (!hasBark && !isConfigured) {
      console.log('   ⚠️ 未配置任何告警渠道，建议至少配置以下方式之一:');
      console.log('   - Bark 推送（推荐）：配置 barkKey');
      console.log('   - 短信/电话告警：配置 Telecom API');
    } else if (!hasBark) {
      console.log('   ℹ️ 仅配置了短信/电话告警，建议同时配置 Bark 推送作为补充');
    } else if (!isConfigured) {
      console.log('   ℹ️ 仅配置了 Bark 推送，建议同时配置短信/电话告警作为紧急情况备用');
    } else {
      console.log('   ✅ 告警渠道配置完整');
    }
    
    console.log('\n=== 检查完成 ===');
  } catch (error) {
    console.error('检查失败:', error instanceof Error ? error.message : String(error));
  }
}

checkAlertConfig();
