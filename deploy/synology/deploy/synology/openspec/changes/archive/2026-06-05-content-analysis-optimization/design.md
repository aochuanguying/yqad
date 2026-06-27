## 上下文

项目是一个部署在群晖 NAS 上的一汽奥迪 APP 自动任务系统。`ContentAnalysisService` 每次运行时从 API 拉取最新帖子、解析、提取特征，然后将分析摘要写入 `data/analysis.json`。

现有问题：
1. **重复分析**：服务每次运行都会拉取相同帖子重新分析，浪费 AI API 调用。
2. **每日无限制**：没有按天限制分析条数的机制。
3. **时间缓存失效策略不合适**：依赖 `cacheHours` 判断是否重新分析，无法控制磁盘上已记录 ID 的增长上限。

## 目标 / 非目标

**目标：**
- 持久化已分析帖子的 ID 集合，每次分析前过滤掉重复帖子
- 每天最多分析前 `dailyLimit` 条（不论是否是新帖），抓取到后即停止
- 引入 `maxCacheCount` 控制已记录 ID 的上限，超出时从末尾（最旧）裁剪
- 移除依赖时间的 `cacheHours` 缓存失效逻辑

**非目标：**
- 不修改分析结果（`AnalysisSummary`）的 AI 处理逻辑
- 不修改评论/发帖服务的调用方式
- 不引入外部数据库，继续使用 JSON 文件持久化

## 决策

### 决策 1：持久化存储位置

**选择**：将已分析帖子 ID 作为 `analyzedIds: string[]` 数组存储在现有的 `data/analysis.json` 文件中。

**理由**：无需新增文件，读写逻辑集中在 `ContentAnalysisService` 中，部署简单。

**替代方案**：新建独立的 `data/analyzed-ids.json`——增加了文件管理复杂度，优势不明显。

---

### 决策 2：每日条数截断语义

**选择**：`dailyLimit` 限制的是"**每次调用 `analyze()` 时最多处理的新帖子条数**"，而非每天跨多次调用的累计值。由于调度器每天只触发一次 `analyze()`，效果等同于每日上限。

**理由**：逻辑简单，无需持久化"今日已分析数"，避免跨日重置的边界问题。

---

### 决策 3：缓存裁剪策略

**选择**：在每次 `saveSummary()` 写入时，检查 `analyzedIds` 数组长度。若超过 `maxCacheCount`，则对数组做 `slice(0, maxCacheCount)` 保留最新的 N 条（数组头部为最新添加的 ID）。

**理由**：保留最近分析过的帖子 ID 比保留最旧的更有实用意义，可以避免近期重复。

**替代方案**：从尾部裁剪保留旧 ID——新帖的去重效果更差。

---

### 决策 4：移除 `isCacheValid` 时间判断

当 `analyze()` 被显式调用时（由调度器驱动），不再做时间判断，直接执行分析并更新 `analyzedIds`。`getSummary()` 仍作为对外接口，但改为直接返回已持久化的摘要（存在则返回，不存在则触发 `analyze()`），去掉时间判断。

## 风险 / 权衡

- **[风险] 首次启动时 `analyzedIds` 为空** → 正常，首次会分析 `dailyLimit` 条帖子并初始化 ID 列表，后续增量处理。
- **[风险] `analysis.json` 格式兼容性** → 读取时对旧格式做兼容处理：若 `analyzedIds` 字段不存在则初始化为空数组。
- **[权衡] 每日调用一次的假设** → 若 `analyze()` 在同一天被多次手动调用，`dailyLimit` 会重复计数。当前业务场景仅靠调度器驱动，该风险可接受。

## 迁移计划

1. 更新 `config/default.yaml`：移除 `analysis.cacheHours`，新增 `analysis.dailyLimit`（默认 `20`）和 `analysis.maxCacheCount`（默认 `200`）。
2. 更新 `src/utils/config.ts` 中 `AnalysisConfig` 类型定义。
3. 修改 `ContentAnalysisService`：
   - `loadCachedSummary()` 兼容读取 `analyzedIds`（旧文件无此字段则默认 `[]`）
   - `analyze()` 在 `fetchLatestPosts()` 后过滤已知 ID，截取前 `dailyLimit` 条
   - `saveSummary()` 合并新 ID 到 `analyzedIds` 头部，裁剪超出 `maxCacheCount` 的部分
   - 删除 `isCacheValid()` 方法
4. 无需数据迁移，旧 `analysis.json` 被读取时自动兼容。

## 开放问题

无。
