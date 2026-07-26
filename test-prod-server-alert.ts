/**
 * 使用生产服务器接口模拟车辆异常告警
 * 直接调用生产服务器的接口，使用生产数据库
 */

import axios from 'axios';

const PROD_BASE_URL = 'http://192.168.50.10:3080';
const API_TOKEN = 'api_token_1640a8b188784e52e08e11eb8dcab3a9fcea5a8d6b03e1235d6705938eed853a';

async function simulateProdAlertViaServer() {
  try {
    console.log('=== 生产服务器车辆异常告警模拟 ===\n');
    
    // 1. 调用外部接口获取车辆状态
    console.log('1. 📡 连接生产服务器...');
    console.log('   服务器地址:', PROD_BASE_URL);
    
    const response = await axios.get(`${PROD_BASE_URL}/api/vehicle-monitor/status/external`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      },
      timeout: 10000
    });
    
    const vehicleData = response.data;
    console.log('   ✅ 接口响应:', vehicleData.code);
    
    if (vehicleData.code !== 'SUCCESS') {
      console.log('   ❌ 获取车辆状态失败:', vehicleData.message);
      return;
    }
    
    const data = vehicleData.data;
    console.log('\n2. 🚗 车辆实时状态:');
    console.log('   - 在线状态:', data.isOnline ? '✅ 在线' : '❌ 离线');
    console.log('   - 异常状态:', data.isAnomaly ? '⚠️ 有异常' : '✅ 正常');
    
    if (data.anomalies && data.anomalies.length > 0) {
      console.log('   - 异常列表:');
      data.anomalies.forEach((anomaly: string) => {
        console.log(`        • ${anomaly}`);
      });
    }
    
    console.log('   - 电池电压:', data.obd?.batteryVolt, 'V');
    console.log('   - 油量:', data.obd?.oilLiters, '升 (' + data.obd?.oilPercent + '%)');
    console.log('   - 车门状态:', data.obd?.anyDoorOpen ? '⚠️ 未关' : '✅ 已关');
    console.log('   - 车窗状态:', data.obd?.anyWindowOpen ? '⚠️ 未关' : '✅ 已关');
    console.log('   - 设防状态:', data.obd?.isDefence ? '✅ 已设防' : '⚠️ 未设防');
    console.log('   - 发动机状态:', data.obd?.engineOn ? '✅ 运行中' : '✅ 已熄火');
    console.log('   - 位置:', data.location ? `${data.location.lat.toFixed(6)}, ${data.location.lng.toFixed(6)}` : '未知');
    console.log('   - 最后检查时间:', new Date(data.lastCheckTime).toLocaleString('zh-CN'));
    console.log();
    
    // 3. 判断是否需要模拟
    if (data.isAnomaly) {
      console.log('3. ⚠️ 车辆检测到异常，应该已自动触发告警');
      console.log('   异常列表:', data.anomalies.join(', '));
      console.log('   ℹ️ 告警应该已经发送到配置的渠道');
    } else {
      console.log('3. 车辆状态正常，将模拟异常场景...');
      console.log('   ℹ️ 如需模拟异常，请在生产服务器上运行测试脚本');
    }
    console.log();
    
    // 4. 获取监控状态
    console.log('4. 📊 获取监控状态...');
    const statusResponse = await axios.get(`${PROD_BASE_URL}/api/vehicle-monitor/status`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`
      },
      timeout: 10000
    });
    
    const statusData = statusResponse.data;
    if (statusData.code === 'SUCCESS') {
      const status = statusData.data;
      console.log('   - 监控启用:', status.enabled ? '✅ 是' : '❌ 否');
      console.log('   - 最后监控时间:', status.lastMonitorTime ? new Date(status.lastMonitorTime).toLocaleString('zh-CN') : '未知');
      
      if (status.alertLogs && status.alertLogs.length > 0) {
        console.log('\n5. 🚨 最近告警记录:');
        status.alertLogs.forEach((log: any, i: number) => {
          console.log(`   [${i + 1}] ${log.type} - ${log.timestamp}`);
          console.log(`       ${log.message}`);
        });
      } else {
        console.log('\n5. 📭 无最近告警记录');
      }
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('\n💡 提示:');
    console.log('   - 如需模拟异常告警，请在生产服务器上运行测试脚本');
    console.log('   - 或通过 Web 界面手动触发告警测试');
    
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const axiosError = error as any;
      if (axiosError.code === 'ECONNREFUSED') {
        console.error('❌ 无法连接到生产服务器');
        console.error('   请确保:');
        console.error('   1. 生产服务器 (192.168.50.10) 已启动');
        console.error('   2. 服务运行在端口 3080');
        console.error('   3. 网络连接正常');
      } else {
        console.error('❌ 请求失败:', axiosError.message);
      }
    } else {
      console.error('❌ 测试失败:', error instanceof Error ? error.message : String(error));
    }
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
}

simulateProdAlertViaServer();
