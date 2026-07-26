/**
 * 模拟车辆异常并触发告警
 */

import { alertService } from './src/services/alert-service';
import { getLogger } from './src/utils/logger';

const logger = getLogger('simulate-alert');

async function simulateVehicleAlert() {
  try {
    console.log('开始模拟车辆异常...');
    
    // 初始化告警服务
    await alertService.init();
    console.log('告警服务初始化完成');
    
    // 模拟异常场景
    const anomalies = [
      '车门未关',
      '车辆未设防',
      '车辆移动 (150 米)',
    ];
    
    // 模拟车辆位置（青岛某地）
    const location = {
      lat: 36.10772373923576,
      lng: 120.41258170164984,
      address: '山东省青岛市即墨区'
    };
    
    console.log('模拟异常数据:', anomalies);
    console.log('模拟位置:', location);
    
    // 触发告警
    console.log('\n触发告警...');
    const result = await alertService.triggerAlert(anomalies, location);
    
    console.log('\n告警结果:');
    console.log('- 成功:', result.success);
    console.log('- 跳过:', result.skipped);
    if (result.skipReason) {
      console.log('- 跳过原因:', result.skipReason);
    }
    if (result.error) {
      console.log('- 错误:', result.error);
    }
    
    console.log('\n模拟完成');
  } catch (error) {
    console.error('模拟异常失败:', error instanceof Error ? error.message : String(error));
  }
}

// 执行模拟
simulateVehicleAlert();
