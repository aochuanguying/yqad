# 发帖日志系统故障排查指南

## 常见问题速查

| 问题现象 | 可能原因 | 排查步骤 | 解决方案 |
|----------|----------|----------|----------|
| 成功率突然下降 | API 限流、网络问题、合规检查变严 | 1. 检查 `/api/posts/logs/alerts`<br>2. 查看 `/api/posts/logs/conversion`<br>3. 检查失败日志的 `errorStack` | 根据具体错误类型处理 |
| 耗时显著增加 | 网络延迟、图片上传慢、AI 生成慢 | 1. 检查 `/api/posts/logs/performance`<br>2. 查看慢请求的 `pipeline_timings` | 优化最慢的环节 |
| 数据库连接失败 | MySQL 服务宕机、连接数耗尽 | 1. 检查 MySQL 服务状态<br>2. 查看应用日志的数据库错误 | 重启 MySQL 或增加连接池 |
| 定时清理未执行 | 定时器异常、进程重启 | 1. 检查日志中的清理记录<br>2. 手动调用 `/api/posts/logs/cleanup` | 重启服务或修复定时器 |
| 监控数据为空 | 数据库迁移未执行、查询条件错误 | 1. 检查表结构是否有新字段<br>2. 验证查询时间范围 | 执行数据库迁移 |

---

## 详细排查流程

### 1. 成功率下降排查

#### 症状
- 监控显示成功率从 90% 下降到 70%
- 告警：`low_success_rate`

#### 排查步骤

**步骤 1: 确定问题环节**
```bash
curl http://localhost:3000/api/posts/logs/conversion
```

如果某个环节转化率显著低于其他环节（如 `imageUpload: 60%` vs 其他 90%+），说明问题出在该环节。

**步骤 2: 查看失败日志**
```bash
curl http://localhost:3000/api/posts/logs?status=failed&limit=20
```

检查失败日志的以下字段：
- `errorStack`: 错误堆栈
- `contextSnapshot`: 错误发生时的上下文
- `pipeline_timings`: 哪个步骤标记为 `failed`

**步骤 3: 分析错误类型**

常见错误类型及处理：

| 错误类型 | 特征 | 解决方案 |
|----------|------|----------|
| `network` | 连接超时、ECONNREFUSED | 检查网络连接、API 服务状态 |
| `api` | HTTP 4xx/5xx 状态码 | 检查 API 限流、服务可用性 |
| `compliance` | 敏感词、违规内容 | 调整内容生成策略、更新敏感词库 |
| `database` | MySQL 错误码 | 检查数据库连接、表结构 |

**步骤 4: 查看实时监控**
```bash
curl http://localhost:3000/api/posts/logs/realtime
```

对比 `currentHour` 和 `today` 的数据：
- 如果 `currentHour.successRate` 远低于 `today.successRate`，说明问题最近发生
- 如果两者都低，说明问题持续存在

---

### 2. 耗时增加排查

#### 症状
- P90 从 80 秒增加到 150 秒
- 告警：`high_duration`

#### 排查步骤

**步骤 1: 获取性能指标**
```bash
curl http://localhost:3000/api/posts/logs/performance
```

对比历史数据，确定是哪个百分位数增加：
- 如果 P50/P90/P99 都增加：整体性能下降
- 如果只有 P99 增加：长尾问题

**步骤 2: 查找慢请求**
```bash
curl http://localhost:3000/api/posts/logs?minDuration=100000&limit=20
```

**步骤 3: 分析 Pipeline 耗时**

检查慢请求的 `pipeline_timings` 字段：
```json
{
  "subDirectionSelection": { "duration": 2000, "status": "success" },
  "contentGeneration": { "duration": 45000, "status": "success" },  // 正常
  "imageUpload": { "duration": 85000, "status": "success" },        // 异常！
  ...
}
```

找出耗时最长的步骤。

**步骤 4: 针对性优化**

| 慢的步骤 | 可能原因 | 优化方案 |
|----------|----------|----------|
| `contentGeneration` | AI 响应慢 | 切换到更快的 AI 提供商、优化 prompt |
| `imageUpload` | 网络慢、图片大 | 压缩图片、使用 CDN、增加并发 |
| `complianceCheck` | 敏感词库大 | 优化匹配算法、缓存结果 |
| `materialSelection` | 素材库大 | 添加索引、优化查询 |

---

### 3. 数据库问题排查

#### 症状
- 应用日志：`ECONNREFUSED`、`Too many connections`
- 所有操作失败

#### 排查步骤

**步骤 1: 检查 MySQL 服务**
```bash
# 检查服务状态
systemctl status mysql

# 检查连接数
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"
```

**步骤 2: 检查慢查询**
```bash
mysql -u root -p -e "SHOW PROCESSLIST;"
```

如果有大量查询堆积，可能是慢查询导致。

**步骤 3: 检查表空间**
```bash
mysql -u root -p -e "SELECT table_name, data_length, index_length FROM information_schema.tables WHERE table_schema = 'yqad';"
```

**步骤 4: 验证表结构**
```bash
mysql -u root -p yqad -e "DESCRIBE post_logs;"
```

确保有以下字段：
- `pipeline_timings` (JSON)
- `total_duration` (BIGINT)
- `resource_usage` (JSON)
- `error_stack` (TEXT)
- `context_snapshot` (JSON)
- `retry_history` (JSON)

---

### 4. 定时清理未执行排查

#### 症状
- `post_logs` 表数据持续增长
- 日志中没有清理记录

#### 排查步骤

**步骤 1: 检查定时器状态**

查看应用启动日志，搜索：
```
已启动发帖日志清理定时器
```

如果没有此日志，说明定时器未启动。

**步骤 2: 手动触发清理**
```bash
curl -X POST http://localhost:3000/api/posts/logs/cleanup \
  -H "Content-Type: application/json" \
  -d '{"maxAgeDays": 30}'
```

如果手动清理成功，说明定时器有问题。

**步骤 3: 检查定时器代码**

查看 [`post-logging-service.ts`](file:///Users/mac/Documents/workspace/krio/yqad/src/services/post-logging-service.ts#L55-L64)：
```typescript
private startCleanupTimer(): void {
  this.cleanupTimerId = setInterval(() => {
    this.cleanupExpired().catch((error) => {
      logger.error(`定时清理发帖日志异常：${error.message}`, { error });
    });
  }, 10 * 60 * 1000);
}
```

确保：
1. `cleanupTimerId` 被正确保存
2. 异常被捕获并记录

**步骤 4: 重启服务**
```bash
# 如果是 PM2 管理
pm2 restart audi-app

# 如果是直接运行
npm start
```

---

### 5. 监控数据为空排查

#### 症状
- 调用 `/api/posts/logs/performance` 返回全 0
- 调用 `/api/posts/logs/conversion` 返回全 0

#### 排查步骤

**步骤 1: 检查数据库迁移**

```bash
mysql -u root -p yqad -e "DESCRIBE post_logs;"
```

如果没有 `pipeline_timings`、`total_duration` 等字段，需要执行迁移：

```bash
npx tsx scripts/apply-migration-032.ts
```

**步骤 2: 检查数据是否存在**
```bash
mysql -u root -p yqad -e "SELECT COUNT(*) FROM post_logs;"
```

如果记录数为 0，说明还没有发帖数据。

**步骤 3: 检查查询时间范围**

如果调用时传递了 `startDate`/`endDate`，确保时间范围正确：
```bash
curl "http://localhost:3000/api/posts/logs/performance?startDate=2026-06-28T00:00:00Z&endDate=2026-06-28T23:59:59Z"
```

**步骤 4: 检查 JSON 字段解析**

查看应用日志，是否有：
```
解析 pipeline_timings 失败
```

如果有，说明数据库中的 JSON 数据格式有问题。

---

## 工具函数

### 1. 快速检查脚本

```bash
#!/bin/bash
# check-post-logging.sh

BASE_URL="http://localhost:3000/api/posts/logs"

echo "=== 发帖日志系统健康检查 ==="
echo ""

echo "1. 检查统计信息..."
curl -s "$BASE_URL/stats" | jq '.data.performance.successRate'

echo "2. 检查性能指标..."
curl -s "$BASE_URL/performance" | jq '.data.p50Duration'

echo "3. 检查环节转化率..."
curl -s "$BASE_URL/conversion" | jq '.data.overallSuccessRate'

echo "4. 检查实时监控..."
curl -s "$BASE_URL/realtime" | jq '.data.currentHour.successRate'

echo "5. 检查告警..."
curl -s "$BASE_URL/alerts" | jq '.data.hasAlerts'

echo ""
echo "=== 检查完成 ==="
```

### 2. 日志分析查询

```sql
-- 查询最近 1 小时的失败记录
SELECT id, title, error_message, created_at 
FROM post_logs 
WHERE status = 'failed' 
  AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY created_at DESC
LIMIT 20;

-- 查询平均耗时最慢的 10 条记录
SELECT id, title, total_duration, created_at
FROM post_logs
WHERE total_duration IS NOT NULL
ORDER BY total_duration DESC
LIMIT 10;

-- 查询各环节失败次数
SELECT 
  JSON_EXTRACT(pipeline_timings, '$.contentGeneration.status') as cg_status,
  COUNT(*) as count
FROM post_logs
WHERE pipeline_timings IS NOT NULL
GROUP BY cg_status;
```

---

## 联系支持

如果以上步骤无法解决问题，请收集以下信息并联系技术支持：

1. **应用日志**: 最近 1 小时的 ERROR 级别日志
2. **数据库状态**: `SHOW PROCESSLIST` 输出
3. **监控截图**: `/api/posts/logs/alerts` 响应
4. **问题复现步骤**: 如何触发问题

---

**文档版本**: 1.0  
**最后更新**: 2026-06-28  
**维护人**: AI Assistant
