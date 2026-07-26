#!/bin/bash
# 在生产服务器 Docker 容器内执行车辆异常告警模拟

echo "=== 生产服务器车辆异常告警模拟 ==="
echo ""

# 在容器内创建测试脚本
docker exec yqad bash -c 'cat > /tmp/test-alert.ts << '\''EOF'\''
import { vehicleMonitorStorage } from "./src/storage/mysql/vehicle-monitor-storage";
import { telecomApiStorage } from "./src/storage/mysql/telecom-api-storage";
import { mobileServiceConfigStorage } from "./src/storage/mysql/mobile-service-config-storage";
import { alertService } from "./src/services/alert-service";

async function test() {
  console.log("=== 生产环境告警配置检查 ===\n");
  
  const vc = await vehicleMonitorStorage.getConfig();
  const tc = await telecomApiStorage.getConfig();
  const sc = await mobileServiceConfigStorage.getConfig();
  
  console.log("车辆监控:", vc?.enabled ? "已启用" : "未启用");
  console.log("Bark Key:", vc?.barkKey ? "已配置 (" + vc.barkKey.substring(0,8) + "...)" : "未配置");
  console.log("告警手机:", vc?.alertPhone || tc?.alertPhone || "未配置");
  console.log("Telecom API:", sc?.apiUrl ? "已配置" : "未配置");
  console.log();
  
  await alertService.init();
  console.log("告警服务已初始化\n");
  
  const anomalies = ["车门未关", "车辆未设防", "车辆移动 (150 米)", "电池电压过低 (11.2V)"];
  const location = { lat: 36.10772373923576, lng: 120.41258170164984, address: "山东省青岛市即墨区" };
  
  console.log("模拟异常:", anomalies.join(", "));
  console.log("位置:", location.address, "\n");
  console.log("触发告警...\n");
  
  const result = await alertService.triggerAlert(anomalies, location);
  
  console.log("\n=== 告警结果 ===");
  console.log("总体状态:", result.success ? "✅ 成功" : (result.skipped ? "⚠️ 跳过" : "❌ 失败"));
  if (result.skipped) console.log("跳过原因:", result.skipReason);
  
  if (result.barkResult) {
    console.log("Bark 推送:", result.barkResult.success ? "✅ 成功" : "❌ 失败");
    if (result.barkResult.error) console.log("  错误:", result.barkResult.error);
  }
  
  if (result.smsResult) {
    console.log("短信通知:", result.smsResult.success ? "✅ 成功" : "�� 失败");
    if (result.smsResult.error) console.log("  错误:", result.smsResult.error);
  }
  
  if (result.callResult) {
    console.log("电话通知:", result.callResult.success ? "✅ 成功" : "❌ 失败");
    if (result.callResult.error) console.log("  错误:", result.callResult.error);
  }
  
  const stats = alertService.getAlertStats();
  console.log("\n告警统计:");
  console.log("  今日:", stats.todayCount);
  console.log("  本周:", stats.weekCount);
  if (stats.topAnomalies.length > 0) {
    console.log("  常见异常:");
    stats.topAnomalies.forEach((item, i) => console.log(`    ${i+1}. ${item.type} (${item.count}次)`));
  }
  
  console.log("\n=== 测试完成 ===");
}

test().catch(e => console.error("测试失败:", e));
EOF

npx tsx /tmp/test-alert.ts'

echo ""
echo "=== 执行完成 ==="
