# 发帖日志系统增强 - 部署清单

## 📋 部署前检查

### 1. 环境准备

- [ ] MySQL 数据库服务运行正常
- [ ] Redis 服务运行正常（如果使用）
- [ ] Node.js 版本 >= 18.0.0
- [ ] 备份现有数据库

### 2. 代码部署

- [ ] 拉取最新代码
- [ ] 安装依赖：`npm install`
- [ ] 编译代码：`npm run build`
- [ ] 验证编译无错误

### 3. 数据库迁移

#### 3.1 执行迁移

```bash
# 方法 1：使用自动迁移脚本
npx tsx scripts/apply-migration-032.ts

# 方法 2：手动执行 SQL
mysql -u root -p yqad < src/db/migrations/032_enhance_post_logs_for_monitoring.sql
```

#### 3.2 验证表结构

```sql
-- 检查新增字段
DESCRIBE post_logs;

-- 应该包含以下字段：
-- pipeline_timings (JSON)
-- total_duration (BIGINT)
-- resource_usage (JSON)
-- error_stack (TEXT)
-- context_snapshot (JSON)
-- retry_history (JSON)
```

#### 3.3 验证索引

```sql
-- 检查索引
SHOW INDEX FROM post_logs;

-- 应该包含以下索引：
-- idx_task_id
-- idx_status_trigger_created
-- idx_total_duration
```

### 4. 功能验证

#### 4.1 验证工具函数

```bash
# 运行工具函数测试
npx tsx scripts/test-post-log-utils.ts
```

**预期输出**：
- 敏感信息脱敏测试通过
- 错误追踪测试通过
- 性能监控测试通过

#### 4.2 验证 API 接口

```bash
# 1. 验证统计信息接口
curl http://localhost:3000/api/posts/logs/stats

# 2. 验证性能指标接口
curl http://localhost:3000/api/posts/logs/performance

# 3. 验证环节转化率接口
curl http://localhost:3000/api/posts/logs/conversion

# 4. 验证实时监控接口
curl http://localhost:3000/api/posts/logs/realtime

# 5. 验证告警检查接口
curl http://localhost:3000/api/posts/logs/alerts

# 6. 验证手动清理接口
curl -X POST http://localhost:3000/api/posts/logs/cleanup \
  -H "Content-Type: application/json" \
  -d '{"maxAgeDays": 30}'
```

**预期响应**：所有接口返回 `{ "success": true, "data": ... }`

#### 4.3 验证 Pipeline 埋点

执行一次自动发帖任务，然后检查日志：

```bash
# 查看最近的发帖日志
curl "http://localhost:3000/api/posts/logs?limit=1"

# 检查响应中是否包含 pipeline_timings 字段
```

**预期字段**：
```json
{
  "pipeline_timings": {
    "subDirectionSelection": { "duration": 1234, "status": "success" },
    "contentGeneration": { "duration": 45678, "status": "success" },
    "materialSelection": { "duration": 2345, "status": "success" },
    "imageUpload": { "duration": 3456, "status": "success" },
    "topicMatching": { "duration": 1234, "status": "success" },
    "diversityTransform": { "duration": 2345, "status": "success" },
    "complianceCheck": { "duration": 3456, "status": "success" },
    "publish": { "duration": 1234, "status": "success" }
  },
  "total_duration": 60000
}
```

### 5. 监控配置

#### 5.1 配置告警阈值

根据业务需求调整告警阈值：

```typescript
// 在 post-logging-service.ts 的 checkAlerts 方法中
const defaultThresholds = {
  minSuccessRate: 80,        // 最低成功率 80%
  maxAverageDuration: 120000, // 最大平均耗时 2 分钟
  maxErrorCount: 10,         // 最大错误数 10
};
```

#### 5.2 配置定时检查

```javascript
// 每 5 分钟检查一次告警
setInterval(async () => {
  const alerts = await postLoggingService.checkAlerts();
  if (alerts.hasAlerts) {
    // 发送告警通知
    sendAlert(alerts.alerts);
  }
}, 5 * 60 * 1000);
```

#### 5.3 配置 Grafana 面板（可选）

导入 Grafana 仪表盘配置：
- 发帖成功率趋势图
- 发帖耗时分布图（P50/P90/P99）
- Pipeline 环节转化率漏斗图
- 实时发帖量柱状图

### 6. 性能基准测试

#### 6.1 执行基准测试

```bash
# 使用 Apache Bench 或 wrk 进行压力测试
ab -n 1000 -c 10 http://localhost:3000/api/posts/logs/stats
```

#### 6.2 记录性能基线

记录以下指标作为基线：
- P50 耗时：___ ms
- P90 耗时：___ ms
- P99 耗时：___ ms
- 成功率：___ %
- 各环节转化率：___ %

### 7. 回滚计划

#### 7.1 回滚数据库迁移

```bash
# 如果出现问题，回滚数据库迁移
mysql -u root -p yqad << EOF
DROP INDEX idx_total_duration ON post_logs;
DROP INDEX idx_status_trigger_created ON post_logs;
DROP INDEX idx_task_id ON post_logs;

ALTER TABLE post_logs
  DROP COLUMN retry_history,
  DROP COLUMN context_snapshot,
  DROP COLUMN error_stack,
  DROP COLUMN resource_usage,
  DROP COLUMN total_duration,
  DROP COLUMN pipeline_timings;
EOF
```

#### 7.2 恢复代码

```bash
# 回滚到上一个版本
git checkout <previous-commit>
npm run build
pm2 restart audi-app
```

### 8. 灰度发布（推荐）

#### 8.1 第一阶段：10% 流量

- 部署到 1 台服务器
- 观察 1 小时
- 检查错误日志
- 验证监控指标

#### 8.2 第二阶段：50% 流量

- 部署到剩余服务器
- 观察 2 小时
- 对比新旧版本性能
- 收集用户反馈

#### 8.3 第三阶段：100% 流量

- 全量发布
- 持续监控 24 小时
- 准备应急响应

### 9. 监控和告警

#### 9.1 关键指标监控

- [ ] 发帖成功率（目标：> 85%）
- [ ] 平均耗时（目标：< 60 秒）
- [ ] P99 耗时（目标：< 180 秒）
- [ ] 数据库连接数
- [ ] 内存使用率
- [ ] CPU 使用率

#### 9.2 告警通知配置

配置以下告警渠道：
- [ ] 钉钉群机器人
- [ ] 企业微信机器人
- [ ] 邮件通知
- [ ] 短信通知（严重告警）

### 10. 文档更新

- [ ] 更新 API 文档
- [ ] 更新运维手册
- [ ] 更新故障排查指南
- [ ] 培训运维人员

---

## ✅ 部署完成检查清单

- [ ] 数据库迁移成功执行
- [ ] 所有 API 接口正常工作
- [ ] Pipeline 埋点正常记录
- [ ] 监控指标正常显示
- [ ] 告警通知正常发送
- [ ] 性能指标符合预期
- [ ] 无错误日志
- [ ] 用户反馈正常

---

## �� 应急联系人

| 角色 | 姓名 | 联系方式 |
|------|------|----------|
| 开发负责人 | ___ | ___ |
| 运维负责人 | ___ | ___ |
| DBA | ___ | ___ |
| 产品经理 | ___ | ___ |

---

**部署日期**: ___年___月___日  
**部署人员**: ___  
**审批人员**: ___  
**部署状态**: □ 成功 □ 失败 □ 回滚
