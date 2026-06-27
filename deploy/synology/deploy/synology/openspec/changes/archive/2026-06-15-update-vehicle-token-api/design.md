## 上下文

当前车辆监控 Token 的更新流程：
1. 从其他设备复制 Token
2. 手动修改 `data/vehicle-token.json` 文件或 `config/default.yaml`
3. 重启服务使 Token 生效

问题：
- 操作繁琐，无法远程自动化
- Token 经常变化，需要频繁更新
- 无法集成到外部系统中

现有架构：
- Token 存储：三层优先级（内存 > 文件 > 配置）
- API 鉴权：使用独立的 API Token 机制（`src/utils/api-token.ts`）
- 路由注册：车辆监控 API 使用登录中间件，发帖 API 使用 API Token 中间件

## 目标 / 非目标

**目标：**
- 提供 RESTful API 端点更新车辆监控 Token
- 支持热加载，修改后立即生效无需重启
- 使用 API Token 进行鉴权，与现有发帖 API 保持一致
- 验证 Token 格式，防止无效 Token

**非目标：**
- 不修改现有 Token 加载逻辑
- 不改变 Token 存储方式（仍使用文件存储）
- 不提供 Token 生成功能（Token 由外部系统提供）
- 不暴露 Token 查询接口（安全性考虑）

## 决策

### 1. API 端点设计
**决策：** 使用 `POST /api/vehicle-monitor/token` 端点
**理由：**
- 与现有车辆监控 API 路径保持一致（`/api/vehicle-monitor`）
- POST 方法符合资源更新语义
- 参考发帖 API 的 Token 管理端点（`/api/posts/token/generate`）

### 2. 鉴权方式
**决策：** 使用 API Token 中间件，而非登录中间件
**理由：**
- 供外部系统调用，无用户登录会话
- 与发帖 API 保持一致的鉴权方式
- 需要将端点添加到白名单配置

### 3. 热加载实现
**决策：** 在车辆监控服务中导出 `updateToken()` 函数，由 API 路由调用
**理由：**
- 保持单例模式，避免服务重复初始化
- 直接更新内存中的 Token，同时持久化到文件
- 参考现有 `setToken()` 函数的实现

### 4. Token 验证
**决策：** 基础格式验证（非空、字符串类型）
**理由：**
- Token 格式由提供方保证
- 避免过度验证导致兼容性问题
- 真实有效性由实际 API 调用验证

## 风险 / 权衡

**风险：** API Token 泄露导致 Token 被恶意篡改
**缓解措施：** 
- API Token 本身需要安全存储和传输
- 可考虑添加 IP 白名单（未来扩展）

**风险：** 并发更新 Token 导致状态不一致
**缓解措施：** 
- 文件写入使用原子操作
- 内存更新使用同步方式

**风险：** 无效 Token 导致监控服务异常
**缓解措施：**
- 保留旧 Token 文件作为备份
- 提供监控状态查询接口验证 Token 有效性
