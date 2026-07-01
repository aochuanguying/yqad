# 知乎 Cookie 自动刷新 - 调度器集成方案

## 📋 概述

参考小红书 Cookie 自动刷新的实现，为知乎添加相同的定时刷新功能。

## 🎯 实现方案

### 方案选择

考虑到实现的复杂度和可维护性，提供两种方案：

#### 方案一：使用现有调度器 + 外部脚本（推荐）

**优点**:
- 实现简单，无需修改现有代码
- 可直接使用 Python 脚本
- 易于调试和维护
- 与小红书方案保持一致

**实现**:
```bash
# 在 crontab 中添加定时任务
0 2 * * * cd /Users/mac/Documents/workspace/krio/yqad/scripts && python3 auto_refresh_zhihu_cookie.py >> /var/log/zhihu_cookie_refresh.log 2>&1
```

#### 方案二：集成到 Node.js 调度器

**优点**:
- 统一管理所有定时任务
- 可在 Web 界面配置

**缺点**:
- 需要修改调度器代码
- 实现复杂度较高

## 🔧 方案一实施步骤（推荐）

### Step 1: 设置定时任务

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨 2 点刷新）
0 2 * * * cd /Users/mac/Documents/workspace/krio/yqad/scripts && /usr/bin/python3 auto_refresh_zhihu_cookie.py >> /var/log/zhihu_cookie_refresh.log 2>&1

# 或者每 12 小时刷新一次
0 */12 * * * cd /Users/mac/Documents/workspace/krio/yqad/scripts && /usr/bin/python3 auto_refresh_zhihu_cookie.py >> /var/log/zhihu_cookie_refresh.log 2>&1
```

### Step 2: 验证定时任务

```bash
# 查看定时任务列表
crontab -l

# 手动测试脚本
cd /Users/mac/Documents/workspace/krio/yqad/scripts
python3 auto_refresh_zhihu_cookie.py
```

### Step 3: 监控日志

```bash
# 查看刷新日志
tail -f /var/log/zhihu_cookie_refresh.log

# 或使用 journalctl（如果使用 systemd）
journalctl -u cron -f
```

## 🔧 方案二实施步骤（可选）

### 修改调度器配置表结构

```sql
-- 添加知乎 Cookie 刷新配置字段
ALTER TABLE scheduler_config
ADD COLUMN zhihu_cookie_refresh_enabled TINYINT(1) DEFAULT 0 COMMENT '是否启用知乎 Cookie 自动刷新',
ADD COLUMN zhihu_cookie_refresh_cron VARCHAR(50) DEFAULT '0 3 * * *' COMMENT '知乎 Cookie 刷新 Cron 表达式',
ADD COLUMN zhihu_cookie_refresh_auto_enabled TINYINT(1) DEFAULT 1 COMMENT '知乎 Cookie 到期自动刷新';
```

### 更新 SchedulerConfigStorage

```typescript
export interface SchedulerConfig {
  // ... 其他配置
  cookieRefresh: {
    enabled: boolean;
    cron: string;
    autoEnabled: boolean;
  };
  zhihuCookieRefresh?: {  // 新增
    enabled: boolean;
    cron: string;
    autoEnabled: boolean;
  };
}
```

### 创建调度器任务

```typescript
// src/scheduler/zhihu-cookie-refresh-job.ts
import { ZhihuCookieScanner } from '../services/cookie-refresh/zhihu-cookie-scanner';
import { schedulerConfigStorage } from '../storage/mysql/scheduler-config-storage';
import { getLogger } from '../utils/logger';

const logger = getLogger('zhihu-cookie-refresh-job');

export class ZhihuCookieRefreshJob {
  private cronExpression: string;
  private enabled: boolean;

  constructor() {
    this.cronExpression = '0 3 * * *'; // 默认每天凌晨 3 点
    this.enabled = false;
  }

  async initialize(): Promise<void> {
    const config = await schedulerConfigStorage.getConfig();
    if (config?.zhihuCookieRefresh) {
      this.cronExpression = config.zhihuCookieRefresh.cron;
      this.enabled = config.zhihuCookieRefresh.enabled;
    }

    if (this.enabled) {
      this.schedule();
    }
  }

  private schedule(): void {
    // 使用 node-cron 或类似库
    // TODO: 实现定时任务调度
  }

  async execute(): Promise<void> {
    logger.info('🔄 开始自动刷新知乎 Cookie...');
    
    try {
      const scanner = ZhihuCookieScanner.getInstance();
      const result = await scanner.refreshCookie();
      
      if (result.success) {
        logger.info(`✅ 知乎 Cookie 刷新成功！版本：${result.version}`);
      } else {
        logger.error(`❌ 知乎 Cookie 刷新失败：${result.error}`);
      }
    } catch (error) {
      logger.error('知乎 Cookie 刷新失败:', error instanceof Error ? error.message : String(error));
    }
  }
}
```

### 注册到主调度器

```typescript
// src/scheduler/index.ts
import { ZhihuCookieRefreshJob } from './zhihu-cookie-refresh-job';

async function initializeScheduler() {
  // ... 其他任务
  
  const zhihuCookieJob = new ZhihuCookieRefreshJob();
  await zhihuCookieJob.initialize();
  
  // ... 启动所有任务
}
```

## 📊 两种方案对比

| 特性 | 方案一（外部脚本） | 方案二（集成调度器） |
|------|------------------|-------------------|
| 实现难度 | ⭐ 简单 | ⭐⭐⭐⭐ 复杂 |
| 可维护性 | ⭐⭐⭐⭐ 高 | ⭐⭐⭐ 中 |
| 统一管理 | ⭐⭐ 低 | ⭐⭐⭐⭐⭐ 高 |
| Web 配置 | ⭐ 不支持 | ⭐⭐⭐⭐⭐ 支持 |
| 日志集中 | ⭐⭐ 分散 | ⭐⭐⭐⭐⭐ 集中 |
| 依赖 | cron | node-cron + 修改代码 |
| 推荐度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## ✅ 推荐方案

**推荐使用方案一**（外部脚本 + crontab），原因：

1. **实现简单**: 无需修改现有代码
2. **易于调试**: 可独立测试脚本
3. **灵活配置**: 可随时修改 crontab
4. **与小红书一致**: 保持相同的实现模式
5. **低耦合**: 不依赖主调度器

## 📝 使用示例

### 手动刷新

```bash
# Python 脚本
python3 /Users/mac/Documents/workspace/krio/yqad/scripts/auto_refresh_zhihu_cookie.py

# TypeScript 测试
npx tsx /Users/mac/Documents/workspace/krio/yqad/scripts/test-zhihu-cookie-refresh.ts

# API 接口
curl -X POST http://localhost:3000/api/network-post-config/zhihu/refresh
```

### 定时刷新

```bash
# 每天凌晨 2 点
0 2 * * * python3 /Users/mac/Documents/workspace/krio/yqad/scripts/auto_refresh_zhihu_cookie.py

# 每 12 小时
0 */12 * * * python3 /Users/mac/Documents/workspace/krio/yqad/scripts/auto_refresh_zhihu_cookie.py

# 每天早上 8 点
0 8 * * * python3 /Users/mac/Documents/workspace/krio/yqad/scripts/auto_refresh_zhihu_cookie.py
```

### 查看状态

```bash
# 查看最近一次刷新日志
tail -n 50 /var/log/zhihu_cookie_refresh.log

# 检查 Cookie 是否更新
mysql -u root -p -e "SELECT zhihu_cookie, updated_at FROM network_post_config WHERE id=1;"
```

## 🔍 监控和告警

### 监控脚本

```bash
#!/bin/bash
# check_zhihu_cookie.sh

# 检查 Cookie 是否超过 7 天未更新
LAST_UPDATE=$(mysql -u root -p -N -e "SELECT TIMESTAMPDIFF(DAY, updated_at, NOW()) FROM network_post_config WHERE id=1;")

if [ "$LAST_UPDATE" -gt 7 ]; then
  echo "⚠️ 警告：知乎 Cookie 已超过 7 天未更新！"
  # 可以发送邮件或短信告警
fi
```

### 添加到 crontab

```bash
# 每天早上 9 点检查
0 9 * * * /path/to/check_zhihu_cookie.sh
```

## 📚 相关文档

- [知乎 Cookie 自动刷新功能](ZHIHU_COOKIE_AUTO_REFRESH.md)
- [知乎 Cookie 配置实施文档](ZHIHU_COOKIE_CONFIG_SETUP.md)
- [小红书 Cookie 自动刷新方案](小红书 Cookie 自动刷新方案.md)

---

**文档更新时间**: 2026-06-30  
**状态**: ✅ 已完成  
**推荐方案**: 方案一（外部脚本 + crontab）
