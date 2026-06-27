# AutoJS API 远程发帖集成 - 修改归档

**日期**: 2026-06-20  
**版本**: v1.0.0

## 修改概述

本次修改实现了 AutoJS API 远程发帖功能，将手工发帖逻辑改为通过 AutoJS API 远程执行脚本，并完善了发帖日志管理和配置功能。

## 主要功能

### 1. AutoJS API 客户端集成

**新增文件**:
- `src/utils/autojs-api-client.ts` - AutoJS API 客户端模块

**功能**:
- 创建 AutoJS API 客户端，支持远程执行脚本
- 自动处理 API Token 认证（使用本服务生成的 Token）
- 支持健康检查和错误处理

### 2. 手工发帖逻辑修改

**修改文件**:
- `src/web/routes/posts-routes.ts`

**变更内容**:
- 修改 `POST /api/posts/execute` 接口
  - 不再直接执行发帖逻辑
  - 改为调用 AutoJS API 执行 `audi_post.js` 脚本（异步方式）
  - 创建 `pending` 状态的日志记录
- 新增 `POST /api/posts/autojs/callback` 接口
  - 接收 AutoJS 脚本的发帖回调
  - 更新日志记录的状态（成功/失败）
  - 根据实际发帖类型更新 `postType`

### 3. 待确认帖子清理级联更新

**修改文件**:
- `src/services/pending-post-service.ts`
- `src/services/post-logging-service.ts`

**变更内容**:
- 待确认帖子服务在清理过期记录时，级联更新对应日志状态为 `failed`
- 发帖日志服务新增方法:
  - `findByTaskId(taskId: string)` - 根据任务 ID 查找日志
  - `update(log: PostLog)` - 更新日志记录
- 类型定义新增 `pending` 状态

### 4. AutoJS 配置页面

**新增文件**:
- `src/web/public/autojs-config.html` - AutoJS API 配置页面

**修改文件**:
- `src/web/public/index.html` - 添加配置页面入口
- `src/web/routes/posts-routes.ts` - 新增配置 API

**功能**:
- 配置 AutoJS API 服务器地址
- 配置发帖脚本名称
- 使用本服务生成的 API Token（无需手动配置）
- 测试连接功能
- 配置缓存修复（保存后立即生效）

### 5. 乱码修复

**修改文件**:
- `src/web/routes/posts-routes.ts`

**变更内容**:
- 清理 AutoJS 回调数据，防止乱码
- 优化日志标题显示
- 将技术性标题改为用户友好标题

### 6. 配置文件

**修改文件**:
- `config/default.yaml`
- `src/utils/config.ts`

**变更内容**:
- 新增 `autojsApi` 配置项
- 支持配置 AutoJS API 地址、Token、脚本名称

## API 接口

### 新增接口

1. **GET /api/posts/autojs/config**
   - 获取 AutoJS API 配置
   - 返回：服务器地址、脚本名称、Token 配置状态

2. **POST /api/posts/autojs/config**
   - 保存 AutoJS API 配置
   - 参数：enabled, baseUrl, postScript

3. **POST /api/posts/autojs/callback**
   - AutoJS 脚本发帖回调
   - 参数：taskId, success, title, content, imageUrls, topicId, topicName, mode

### 修改接口

**POST /api/posts/execute**
- 从直接执行发帖改为调用 AutoJS API
- 返回脚本执行状态

## 工作流程

```
用户点击"立即发帖"
    ↓
调用 AutoJS API 执行脚本（异步）
    ↓
创建日志记录（状态：pending）
    ↓
AutoJS 脚本在手机上执行
    ↓
    ├─→ 发帖成功 → 调用回调 API → 更新日志为 success
    │                        更新 postType（topic/free）
    │
    └─→ 脚本异常未回调 → 待确认记录过期（30 分钟）
                          ↓
                       级联更新日志为 failed
```

## 配置说明

### AutoJS API 配置

```yaml
autojsApi:
  enabled: true
  baseUrl: "http://192.168.50.149:8899"
  postScript: "audi_post.js"
  # apiToken 使��本服务生成的，不从配置页面设置
```

### 环境变量（可选）

```bash
export AUTOJS_API_ENABLED=true
export AUTOJS_API_BASE_URL="http://192.168.50.149:8899"
export AUTOJS_API_POST_SCRIPT="audi_post.js"
```

## 部署说明

### 同步到部署目录

```bash
# 编译
npm run build

# 同步到部署目录
cp -r dist/* synology-deploy-root/app/dist/
cp -r src/web/public/* synology-deploy-root/app/src/web/public/
```

### 部署到 Synology

1. 将 `synology-deploy-root/app` 部署到群晖
2. 重启服务
3. 访问 `http://<server>:3000/autojs-config.html` 配置 AutoJS API

## 测试验证

### 1. 配置 AutoJS API

访问 `http://localhost:3000/autojs-config.html`
- 启用 AutoJS API
- 填写服务器地址
- 填写脚本名称
- 点击"保存配置"
- 点击"测试连接"验证

### 2. 测试手工发帖

1. 点击"立即发帖"按钮
2. 查看日志：应显示"手工发帖（AutoJS 远程执行）"
3. AutoJS 脚本执行成功后回调
4. 日志状态更新为 `success`，显示实际标题

### 3. 测试超时处理

1. 手工发帖（不回调）
2. 等待 30 分钟
3. 查看日志状态应变为 `failed`
4. 错误信息："发帖任务超时未确认"

## 注意事项

1. **API Token**: 使用本服务生成的发帖 API Token，无需手动配置
2. **配置缓存**: 保存配置后会自动清除缓存，立即生效
3. **乱码修复**: 回调数据会进行清理，防止特殊字符导致乱码
4. **超时处理**: 30 分钟未回调的日志会自动标记为失败
5. **发帖类型**: 由 AutoJS 脚本自行判断使用主题或自由模式

## 相关文件

### 源代码
- `src/utils/autojs-api-client.ts` - AutoJS API 客户端
- `src/utils/api-token.ts` - API Token 管理
- `src/web/routes/posts-routes.ts` - 路由和 API
- `src/services/pending-post-service.ts` - 待确认帖子服务
- `src/services/post-logging-service.ts` - 发帖日志服务
- `src/types/post-logging.ts` - 日志类型定义
- `src/web/public/autojs-config.html` - 配置页面

### 配置文件
- `config/default.yaml` - 主配置文件
- `src/utils/config.ts` - 配置加载工具

### 文档
- `docs/AUTOJS_API_USAGE.md` - AutoJS API 使用说明
- `docs/PENDING_POST_CLEANUP.md` - 待确认帖子清理机制
- `CHANGELOG_AUTOJS_INTEGRATION.md` - 本文档

## 版本历史

- **v1.0.0** (2026-06-20)
  - 初始版本
  - 实现 AutoJS API 远程发帖
  - 实现配置页面
  - 实现级联更新机制
  - 修复乱码问题
  - 修复配置缓存问题
