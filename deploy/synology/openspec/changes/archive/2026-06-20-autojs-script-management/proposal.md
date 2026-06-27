## 为什么

当前 AutoJS API 配置界面仅支持配置服务器地址和单个发帖脚本名称，用户无法查看 AutoJS 服务器上有哪些可用脚本，也无法手动执行其他脚本。这限制了用户对 AutoJS 脚本的灵活管理和使用。

## 变更内容

在 AutoJS API 服务配置界面增加以下功能：

1. **脚本列表展示**：调用 AutoJS API 的 `GET /api/scripts` 接口，获取并展示服务器上所有可用脚本
2. **脚本执行功能**：在每个脚本旁边增加"立即执行"按钮，点击后调用 AutoJS API 的 `POST /api/execute` 接口执行对应脚本

## 功能 (Capabilities)

### 新增功能

- `autojs-script-list`: 在配置页面展示 AutoJS 服务器上的所有脚本列表
- `autojs-script-executor`: 支持手动执行任意脚本，带执行状态反馈

### 修改功能

- `autojs-config-page`: AutoJS 配置页面的布局和功能扩展（增加脚本列表展示区域）

## 影响

**受影响的文件**:
- `src/web/public/autojs-config.html` - 增加脚本列表展示和执行功能
- `src/utils/autojs-api-client.ts` - 可能需要增加获取脚本列表的方法

**API 依赖**:
- 依赖 AutoJS API 服务的 `/api/scripts` 接口（已存在）
- 依赖 AutoJS API 服务的 `/api/execute` 接口（已存在）

**用户体验**:
- 用户可以直观看到所有可用脚本
- 支持一键执行任意脚本，增强灵活性
- 执行状态实时反馈，提升交互体验
