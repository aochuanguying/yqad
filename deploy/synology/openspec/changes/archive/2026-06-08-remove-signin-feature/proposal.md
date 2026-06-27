## 为什么

签到 API 因缺少必要的签名算法（x-fawvw-sign）而无法使用，且已禁用。删除签到相关代码可以简化系统，减少维护成本。

## 变更内容

- **移除签到功能**：删除所有签到相关的服务、API 接口、定时任务和配置
- **更新每日摘要**：移除签到相关的统计和告警逻辑
- **更新前端界面**：移除配置页面的签到 Tab

## 功能 (Capabilities)

### 新增功能
<!-- 无新增功能 -->

### 修改功能
<!-- 无修改的功能规范，仅删除 -->

## 影响

- **删除的文件**:
  - `src/services/signin.ts` - 签到服务
  - `dist/services/signin.*` - 编译后的签到服务文件

- **修改的文件**:
  - `src/api/types.ts` - 移除 SigninResponse 接口和 signin 方法定义
  - `src/api/real-client.ts` - 移除 signin 方法实现
  - `src/api/mock-client.ts` - 移除 signin 方法实现
  - `src/scheduler/index.ts` - 移除签到定时任务
  - `src/index.ts` - 移除签到服务初始化和调度
  - `src/services/daily-summary.ts` - 移除签到相关的摘要和告警
  - `src/web/public/index.html` - 移除签到配置 Tab
  - `config/default.yaml` - 移除签到配置项
  - `config/local.yaml` - 移除签到配置项

- **破坏性变更**: 
  - **BREAKING**: 签到 API 和相关配置已完全移除，无法再通过配置启用签到功能
