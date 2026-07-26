/**
 * 模拟车辆异常并触发告警（直接调用服务层）
 */

import { vehicleMonitorService, runVehicleMonitor } from './src/services/vehicle-monitor-service';
import { alertService } from './src/services/alert-service';
import { getLogger } from './src/utils/logger';

const logger = getLogger('simulate-alert');

async function simulateVehicleAlert() {
  try {
    console.log('=== 开始模拟车辆异常 ===\n');
    
    // 1. 初始化告警服务
    console.log('1. 初始化告警服务...');
    await alertService.init();
    console.log('   告警服务初始化完成\n');
    
    // 2. 执行车辆监控（获取真实数据）
    console.log('2. 执行车辆监控...');
    await runVehicleMonitor();
    
    // 等待状态更新
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. 获取监控状态
    const status = vehicleMonitorService.getLastStatus();
    console.log('   监控执行完成\n');
    
    if (!status) {
      console.log('   警告：无法获取车辆状态');
      return;
    }
    
    // 4. 显示当前状态
    console.log('3. 当前车辆状态:');
    console.log('   - 在线状态:', status.carInfo?.isOnline ? '在线' : '离线');
    console.log('   - 异常状态:', status.isAnomaly ? '有异常' : '正常');
    if (status.anomalies && status.anomalies.length > 0) {
      console.log('   - 异常列表:', status.anomalies.join(', '));
    }
    console.log('   - 最后检查时间:', status.lastCheckTime);
    console.log();
    
    // 5. 如果状态正常，模拟异常数据
    if (!status.isAnomaly) {
      console.log('4. 车辆状态正常，模拟异常数据...');
      
      // 模拟异常：车门未关、车辆移动
      status.isAnomaly = true;
      status.anomalies = ['车门未关', '车辆移动 (150 米)', '车辆未设防'];
      
      console.log('   模拟异常:', status.anomalies.join(', '));
      console.log();
      
      // 6. 触发告警
      console.log('5. 触发告警...');
      const location = status.location ? {
        lat: status.location.lat,
        lng: status.location.lng,
        address: '模拟位置'
      } : undefined;
      
      const result = await alertService.triggerAlert(status.anomalies, location);
      
      console.log('\n6. 告警结果:');
      console.log('   - 成功:', result.success);
      console.log('   - 跳过:', result.skipped);
      if (result.skipReason) {
        console.log('   - 跳过原因:', result.skipReason);
      }
      if (result.barkResult) {
        console.log('   - Bark 状态:', result.barkResult.success ? '成功' : '失败');
        if (result.barkResult.error) {
          console.log('   - Bark 错误:', result.barkResult.error);
        }
      }
      if (result.smsResult) {
        console.log('   - 短信状态:', result.smsResult.success ? '成功' : '失败');
        if (result.smsResult.error) {
          console.log('   - 短信错误:', result.smsResult.error);
        }
      }
      if (result.callResult) {
        console.log('   - 电话状态:', result.callResult.success ? '成功' : '失败');
        if (result.callResult.error) {
          console.log('   - 电话错误:', result.callResult.error);
        }
      }
    } else {
      console.log('4. 车辆已有异常，无需模拟');
      console.log('   异常列表:', status.anomalies.join(', '));
    }
    
    console.log('\n=== 模拟完成 ===');
  } catch (error) {
    console.error('模拟异常失败:', error instanceof Error ? error.message : String(error));
    console.error(error);
  }
}

// 执行模拟
simulateVehicleAlert();
