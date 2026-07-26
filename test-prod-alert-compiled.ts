import { vehicleMonitorStorage } from "./dist/storage/mysql/vehicle-monitor-storage.js";
import { telecomApiStorage } from "./dist/storage/mysql/telecom-api-storage.js";
import { mobileServiceConfigStorage } from "./dist/storage/mysql/mobile-service-config-storage.js";
import { alertService } from "./dist/services/alert-service.js";

async function test() {
  console.log("=== 生产环境告警配置检查 ===\n");
  
  const vc = await vehicleMonitorStorage.getConfig();
  const tc = await telecomApiStorage.getConfig();
  const sc = await mobileServiceConfigStorage.getConfig();
  
  console.log("1. 配置信息:");
  console.log("   车辆监控:", vc?.enabled ? "✅ 已启用" : "⚠️ 未启用");
  console.log("   Bark Key:", vc?.barkKey ? "✅ 已配置 (" + vc.barkKey.substring(0,8) + "...)" : "❌ 未配置");
  console.log("   Bark Server:", vc?.barkServer || "默认");
  console.log("   告警手机:", vc?.alertPhone || tc?.alertPhone || "❌ 未配置");
  console.log("   Telecom API:", sc?.apiUrl ? "✅ " + sc.apiUrl : "❌ 未配置");
  console.log("   API Token:", sc?.apiToken ? "✅ 已配置" : "❌ 未配置");
  console.log();
  
  console.log("2. 初始化告警服务...");
  await alertService.init();
  console.log("   ✅ 告警服务已初始化\n");
  
  const anomalies = ["车门未关", "车辆未设防", "车辆移动 (150 米)", "电池电压过低 (11.2V)"];
  const location = { lat: 36.10772373923576, lng: 120.41258170164984, address: "山东省青岛市即墨区奥捷智行汽车" };
  
  console.log("3. 模拟异常数据:");
  anomalies.forEach((a, i) => console.log(`   ${i+1}. ${a}`));
  console.log("\n   位置:", location.address);
  console.log("   坐标:", location.lat.toFixed(6), ",", location.lng.toFixed(6));
  console.log();
  
  console.log("4. 🚨 触发告警通知...\n");
  const result = await alertService.triggerAlert(anomalies, location);
  
  console.log("\n5. 📊 告警结果:");
  console.log("   ┌─────────────────────────────────────────┐");
  console.log(`   │ 总体状态：${result.success ? '✅ 成功' : (result.skipped ? '⚠️ 跳过' : '❌ 失败')}                          │`);
  
  if (result.skipped && result.skipReason) {
    console.log(`   │ 跳过原因：${result.skipReason.padEnd(28)}│`);
  }
  
  if (result.barkResult) {
    const status = result.barkResult.success ? '✅ 成功' : '❌ 失败';
    console.log(`   │ 📱 Bark: ${status.padEnd(29)}│`);
    if (result.barkResult.error) {
      console.log(`   │   错误：${result.barkResult.error}`);
    }
  }
  
  if (result.smsResult) {
    const status = result.smsResult.success ? '✅ 成功' : '❌ 失败';
    console.log(`   │ 💬 短信：${status.padEnd(29)}│`);
    if (result.smsResult.error) {
      console.log(`   │   错误：${result.smsResult.error}`);
    }
  }
  
  if (result.callResult) {
    const status = result.callResult.success ? '✅ 成功' : '❌ 失败';
    console.log(`   │ 📞 电话：${status.padEnd(29)}│`);
    if (result.callResult.error) {
      console.log(`   │   错误：${result.callResult.error}`);
    }
  }
  
  console.log("   └─────────────────────────────────────────┘\n");
  
  const stats = alertService.getAlertStats();
  console.log("6. �� 告警统计:");
  console.log(`   今日告警：${stats.todayCount}`);
  console.log(`   本周告警：${stats.weekCount}`);
  if (stats.topAnomalies.length > 0) {
    console.log("\n   常见异常:");
    stats.topAnomalies.forEach((item, i) => {
      console.log(`     ${i+1}. ${item.type} (${item.count}次)`);
    });
  }
  
  console.log("\n=== 测试完成 ===\n");
}

test().catch(e => console.error("❌ 测试失败:", e));
