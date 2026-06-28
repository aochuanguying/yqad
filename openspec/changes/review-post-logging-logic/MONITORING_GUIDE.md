# 发帖日志监控指标使用说明

## 概述

发帖日志系统现已增强，支持以下监控功能：
- **性能指标**：P50/P90/P99 百分位数统计
- **环节转化率**：Pipeline 各步骤的成功率
- **实时监控**：当前小时和今日累计指标
- **异常告警**：自动检测成功率下降、耗时增加、错误数超标

---

## API 接口

### 1. 获取统计信息

**端点**: `GET /api/posts/logs/stats`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 150,
    "byTriggerType": {
      "auto": 120,
      "manual": 30
    },
    "byStatus": {
      "success": 135,
      "failed": 15
    },
    "performance": {
      "averageDuration": 45000,
      "minDuration": 12000,
      "maxDuration": 180000,
      "successRate": 90.00
    }
  }
}
```

**字段说明**:
- `total`: 总记录数
- `byTriggerType`: 按触发方式分类（auto=自动，manual=手动）
- `byStatus`: 按状态分类
- `performance`: 性能统计
  - `averageDuration`: 平均耗时（毫秒）
  - `minDuration`: 最小耗时
  - `maxDuration`: 最大耗时
  - `successRate`: 成功率（百分比）

---

### 2. 获取性能指标（P50/P90/P99）

**端点**: `GET /api/posts/logs/performance`

**查询参数**:
- `startDate` (可选): 开始时间（ISO 格式）
- `endDate` (可选): 结束时间（ISO 格式）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "averageDuration": 45000,
    "p50Duration": 42000,
    "p90Duration": 78000,
    "p99Duration": 150000,
    "minDuration": 12000,
    "maxDuration": 180000,
    "successRate": 90.00,
    "totalPosts": 150
  }
}
```

**字段说明**:
- `p50Duration`: 50% 的请求耗时低于此值（中位数）
- `p90Duration`: 90% 的请求耗时低于此值
- `p99Duration`: 99% 的请求耗时低于此值

**使用场景**:
- 识别性能瓶颈：如果 P99 远大于 P50，说明有少量请求耗时极长
- 设定 SLA：例如"90% 的发帖请求应在 60 秒内完成"

---

### 3. 获取环节转化率

**端点**: `GET /api/posts/logs/conversion`

**查询参数**:
- `startDate` (可选): 开始时间
- `endDate` (可选): 结束时间

**响应示例**:
```json
{
  "success": true,
  "data": {
    "subDirectionSelection": 98.50,
    "contentGeneration": 95.20,
    "materialSelection": 92.00,
    "imageUpload": 88.50,
    "topicMatching": 97.00,
    "diversityTransform": 96.50,
    "complianceCheck": 94.00,
    "publish": 91.00,
    "overallSuccessRate": 90.00
  }
}
```

**字段说明**（Pipeline 步骤）:
1. `subDirectionSelection`: 子方向选择成功率
2. `contentGeneration`: 内容生成成功率
3. `materialSelection`: 素材选择成功率
4. `imageUpload`: 图片上传成功率
5. `topicMatching`: 话题匹配成功率
6. `diversityTransform`: 多样化变换成功率
7. `complianceCheck`: 合规检查通过率
8. `publish`: 发布成功率
9. `overallSuccessRate`: 总体成功率

**使用场景**:
- 定位瓶颈环节：如果某个环节转化率显著低于其他环节，说明该环节存在问题
- 优化优先级：优先改进转化率最低的环节

---

### 4. 获取实时监控指标

**端点**: `GET /api/posts/logs/realtime`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "currentHour": {
      "totalPosts": 12,
      "successRate": 91.67,
      "averageDuration": 43000,
      "errorCount": 1
    },
    "today": {
      "totalPosts": 85,
      "successRate": 90.59,
      "averageDuration": 45000,
      "errorCount": 8
    }
  }
}
```

**字段说明**:
- `currentHour`: 当前小时（从整点到现在）的统计
- `today`: 今日累计（从 0 点到现在）的统计

**使用场景**:
- 实时监控：定时（如每分钟）调用此接口，绘制趋势图
- 快速发现问题：如果当前小时指标明显差于今日平均，说明最近出现了问题

---

### 5. 检查异常告警

**端点**: `GET /api/posts/logs/alerts`

**查询参数**:
- `minSuccessRate` (可选): 最低成功率阈值（百分比），默认 80
- `maxAverageDuration` (可选): 最大平均耗时（毫秒），默认 120000（2 分钟）
- `maxErrorCount` (可选): 最大错误数，默认 10

**响应示例**（有告警）:
```json
{
  "success": true,
  "data": {
    "hasAlerts": true,
    "alerts": [
      {
        "type": "low_success_rate",
        "severity": "severe",
        "message": "当前小时成功率低于阈值：75.00% < 80%",
        "value": 75.00,
        "threshold": 80
      },
      {
        "type": "high_error_count",
        "severity": "critical",
        "message": "当前小时错误数超过阈值：15 > 10",
        "value": 15,
        "threshold": 10
      }
    ]
  }
}
```

**响应示例**（无告警）:
```json
{
  "success": true,
  "data": {
    "hasAlerts": false,
    "alerts": []
  }
}
```

**告警类型**:
- `low_success_rate`: 成功率过低
- `high_duration`: 平均耗时过长
- `high_error_count`: 错误数过多

**严重程度**:
- `critical`: 致命（错误数超标）
- `severe`: 严重（成功率过低）
- `warning`: 警告（耗时过长）

**使用场景**:
- 定时检查：每 5-10 分钟调用一次
- 告警通知：如果 `hasAlerts: true`，发送通知到钉钉/企业微信/邮件

---

## 监控面板示例

### Grafana 面板配置建议

1. **发帖成功率趋势**
   - 数据源：`GET /api/posts/logs/realtime`
   - 指标：`currentHour.successRate`
   - 告警线：80%

2. **发帖耗时分布**
   - 数据源：`GET /api/posts/logs/performance`
   - 指标：`p50Duration`, `p90Duration`, `p99Duration`
   - 图表类型：多线图

3. **Pipeline 环节转化率**
   - 数据源：`GET /api/posts/logs/conversion`
   - 图表类型：漏斗图

4. **实时发帖量**
   - 数据源：`GET /api/posts/logs/realtime`
   - 指标：`currentHour.totalPosts`
   - 图表类型：柱状图（按小时）

---

## 最佳实践

### 1. 定时检查
```javascript
// 每 5 分钟检查一次告警
setInterval(async () => {
  const response = await fetch('http://localhost:3000/api/posts/logs/alerts');
  const result = await response.json();
  
  if (result.data.hasAlerts) {
    // 发送告警通知
    sendAlert(result.data.alerts);
  }
}, 5 * 60 * 1000);
```

### 2. 性能基线
建议先收集 1-2 周的数据，建立性能基线：
- P50: 40-50 秒
- P90: 70-90 秒
- P99: 120-180 秒
- 成功率：85-95%

### 3. 告警阈值调优
根据实际运行情况调整阈值：
- 如果误报过多，适当放宽阈值
- 如果漏报，收紧阈值或增加新的告警类型

---

## 故障排查

### 问题 1：成功率突然下降

**排查步骤**:
1. 调用 `GET /api/posts/logs/conversion` 查看哪个环节转化率下降
2. 调用 `GET /api/posts/logs/performance` 查看耗时是否增加
3. 调用 `GET /api/posts/logs?status=failed&limit=20` 查看最近的失败记录
4. 检查失败记录的 `errorStack` 和 `contextSnapshot` 字段

### 问题 2：耗时突然增加

**排查步骤**:
1. 调用 `GET /api/posts/logs/performance` 对比 P50/P90/P99
2. 如果 P99 显著增加，说明有长尾请求
3. 调用 `GET /api/posts/logs?minDuration=100000&limit=20` 查看慢请求
4. 检查慢请求的 `pipeline_timings` 字段，定位哪个步骤耗时最长

### 问题 3：某个环节转化率持续偏低

**排查步骤**:
1. 确定是哪个环节（如 `imageUpload`）
2. 调用 `GET /api/posts/logs?status=failed&limit=50` 查看失败记录
3. 筛选出该环节失败的记录（通过 `pipeline_timings` 字段）
4. 分析失败原因（网络问题、API 限制、素材不足等）

---

## 附录：完整 API 列表

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/posts/logs` | GET | 查询日志列表（分页） |
| `/api/posts/logs/:id` | GET | 查询单条日志详情 |
| `/api/posts/logs/stats` | GET | 获取统计信息 |
| `/api/posts/logs/performance` | GET | 获取性能指标（P50/P90/P99） |
| `/api/posts/logs/conversion` | GET | 获取环节转化率 |
| `/api/posts/logs/realtime` | GET | 获取实时监控指标 |
| `/api/posts/logs/alerts` | GET | 检查异常告警 |
| `/api/posts/logs/cleanup` | POST | 手动清理过期日志 |

---

**文档版本**: 1.0  
**最后更新**: 2026-06-28  
**维护人**: AI Assistant
