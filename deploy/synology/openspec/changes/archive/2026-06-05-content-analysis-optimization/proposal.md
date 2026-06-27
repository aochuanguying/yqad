## 为什么

当前内容分析服务每次运行都会重新抓取并分析所有帖子，无法感知重复内容，导致 AI 调用浪费。同时缓存策略依赖时间过期，无法控制存储增长，长期运行后 `analysis.json` 会无限膨胀。

## 变更内容

- **新增帖子去重**：引入已分析帖子 ID 的持久化记录，每次抓取后过滤掉已处理过的帖子，避免重复分析。
- **每日分析条数上限**：新增配置项 `analysis.dailyLimit`，每天最多分析前 X 条新帖子，超出后停止（即使前 X 条全是重复帖也不继续抓取更多）。
- **缓存条数上限替换时间缓存**：移除 `analysis.cacheHours` 时间过期策略，改为 `analysis.maxCacheCount` 条数上限。当已分析帖子的缓存记录超过该上限时，从末尾（最旧的记录）开始删除。
- **配置项调整**：在 `config/default.yaml` 的 `analysis` 块中，移除 `cacheHours`，新增 `dailyLimit` 和 `maxCacheCount`。

## 功能 (Capabilities)

### 新增功能

- `analysis-dedup`: 基于帖子 ID 的去重机制——持久化已分析 ID 集合，每轮分析前过滤重复帖子，每日只处理前 `dailyLimit` 条新帖，缓存记录超出 `maxCacheCount` 时从末尾裁剪。

### 修改功能

（无规范层面的现有功能变更）

## 影响

- `src/services/content-analysis.ts`：核心修改，新增去重逻辑、每日条数截断、条数裁剪清理，移除 `isCacheValid` 时间判断。
- `config/default.yaml`：`analysis` 块新增 `dailyLimit`（默认 20）和 `maxCacheCount`（默认 200），移除 `cacheHours`。
- `data/analysis.json`：数据结构扩展，新增 `analyzedIds`（已分析帖子 ID 数组）字段。
- `src/utils/config.ts`：如有类型定义需同步更新配置类型。
