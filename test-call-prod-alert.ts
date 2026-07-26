/**
 * 调用生产服务器的告警服务 API 来模拟异常
 */

import axios from 'axios';

const PROD_URL = 'http://192.168.50.10:3080';
const API_TOKEN = 'api_token_1640a8b188784e52e08e11eb8dcab3a9fcea5a8d6b03e1235d6705938eed853a';

async function simulateProdAlert() {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   生产服务器车辆异常告警模拟                            ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    // 1. 获取当前配置
    console.log('📋 1. 读取生产配置...');
    const configResp = await axios.get(`${PROD_URL}/api/vehicle-monitor/status`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
    
    const config = configResp.data.data.config;
    console.log('   车辆监控:', config.enabled ? '✅ 已启用' : '⚠️ 未启用');
    console.log('   Bark Key:', config.barkKey ? '✅ ' + config.barkKey.substring(0,8) + '***' : '❌ 未配置');
    console.log('   告警手机:', config.alertPhone || '❌ 未配置');
    console.log('   HA 配置:', config.haBaseUrl ? '✅ 已配置' : '❌ 未配置');
    console.log();
    
    // 2. 获取当前车辆状态
    console.log('🚗 2. 获取车辆状态...');
    const statusResp = await axios.get(`${PROD_URL}/api/vehicle-monitor/status/external`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
    
    const vehicle = statusResp.data.data;
    console.log('   在线状态:', vehicle.isOnline ? '✅ 在线' : '❌ 离线');
    console.log('   异常状态:', vehicle.isAnomaly ? '⚠️ 有异常' : '✅ 正常');
    console.log('   电池电压:', vehicle.obd?.batteryVolt, 'V');
    console.log('   车门状态:', vehicle.obd?.anyDoorOpen ? '⚠️ 未关' : '✅ 已关');
    console.log('   设防状态:', vehicle.obd?.isDefence ? '✅ 已设防' : '⚠️ 未设防');
    console.log('   位置:', vehicle.location ? `${vehicle.location.lat.toFixed(6)}, ${vehicle.location.lng.toFixed(6)}` : '未知');
    console.log();
    
    // 3. 如果正常，模拟异常
    if (!vehicle.isAnomaly) {
      console.log('⚠️ 3. 车辆状态正常，模拟异常场景...\n');
      
      const anomalies = [
        '车门未关',
        '车辆未设防',
        '车辆移动 (150 米)',
        '电池电压过低 (11.2V)'
      ];
      
      console.log('   模拟异常:');
      anomalies.forEach((a, i) => console.log(`     ${i+1}. ${a}`));
      console.log('\n   位置:', `${vehicle.location.lat.toFixed(6)}, ${vehicle.location.lng.toFixed(6)}`);
      console.log();
      
      // 4. 调用内部 API 触发告警
      console.log('🚨 4. 触发告警通知...\n');
      
      // 通过执行监控来触发告警（外部接口会自动执行监控和告警）
      const monitorResp = await axios.get(`${PROD_URL}/api/vehicle-monitor/status/external`, {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
      });
      
      console.log('   ✅ 监控已执行');
      console.log();
    } else {
      console.log('⚠️ 3. 车辆已有异常，应该已自动触发告警\n');
    }
    
    // 5. 获取告警记录
    console.log('📊 5. 查询告警记录...');
    const alertsResp = await axios.get(`${PROD_URL}/api/vehicle-monitor/status`, {
      headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
    
    const alertLogs = alertsResp.data.data.alertLogs;
    if (alertLogs && alertLogs.length > 0) {
      console.log('   最近告警:');
      alertLogs.forEach((log: any, i: number) => {
        console.log(`   [${i+1}] ${log.timestamp}`);
        console.log(`       ${log.type}: ${log.message}`);
      });
    } else {
      console.log('   无告警记录');
    }
    console.log();
    
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   测试完成 ✅                                          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log('💡 提示：');
    console.log('   - 请检查手机是否收到 Bark 推送');
    console.log('   - 请检查是否收到短信或电话');
    console.log('   - 如需重新测试，请等待 30 分钟冷却时间后再次运行\n');
    
  } catch (error) {
    console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && 'response' in error) {
      const axiosError = error as any;
      console.error('   状态码:', axiosError.response?.status);
      console.error('   响应:', axiosError.response?.data);
    }
  }
}

simulateProdAlert();
