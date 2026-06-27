## 1. 配置项更新

- [x] 1.1 在 `config/default.yaml` 的 `analysis` 块中移除 `cacheHours` 字段，新增 `dailyLimit: 20` 和 `maxCacheCount: 200`
- [x] 1.2 更新 `src/utils/config.ts` 中 `AnalysisConfig` 类型定义：移除 `cacheHours: number`，新增 `dailyLimit: number` 和 `maxCacheCount: number`

## 2. 数据结构扩展

- [x] 2.1 在 `content-analysis.ts` 的 `AnalysisSummary` 接口中新增 `analyzedIds: string[]` 字段
- [x] 2.2 更新 `loadCachedSummary()` 方法：读取旧格式文件时，若 `analyzedIds` 字段缺失则默认初始化为空数组，保证向后兼容

## 3. 去重与条数限制

- [x] 3.1 修改 `analyze()` 方法：在 `fetchLatestPosts()` 获取帖子后，从结果中过滤掉 ID 已存在于 `analyzedIds` 的帖子
- [x] 3.2 在去重后，对剩余新帖子执行 `slice(0, config.analysis.dailyLimit)` 截取前 `dailyLimit` 条
- [x] 3.3 处理全部帖子均为重复的情况：若去重后无新帖子，跳过分析步骤，直接返回已持久化的摘要（无摘要则返回空摘要）

## 4. 缓存写入与裁剪

- [x] 4.1 修改 `saveSummary()` 方法：将本次分析的帖子 ID 合并到 `analyzedIds` 头部（新 ID 在前）
- [x] 4.2 在写入前检查 `analyzedIds` 长度，若超过 `config.analysis.maxCacheCount` 则执行 `slice(0, maxCacheCount)` 裁剪尾部旧记录
- [x] 4.3 将 `analyzedIds` 连同摘要数据一并序列化写入 `data/analysis.json`

## 5. 移除时间缓存逻辑

- [x] 5.1 删除 `isCacheValid()` 方法
- [x] 5.2 修改 `getSummary()` 方法：改为直接返回已持久化的摘要（存在即返回），不存在时调用 `analyze()`，移除时间戳判断逻辑

## 6. 测试验证

- [x] 6.1 验证去重逻辑：模拟 `analyzedIds` 中已有部分帖子 ID，确认 `analyze()` 只处理新帖子
- [x] 6.2 验证 `dailyLimit` 截断：模拟超过上限的新帖数量，确认只处理前 `dailyLimit` 条
- [x] 6.3 验证 `maxCacheCount` 裁剪：模拟 `analyzedIds` 超出上限，确认写入后数组长度等于 `maxCacheCount`
- [x] 6.4 验证全部重复场景：确认无新帖时不发起 AI 调用，直接返回缓存摘要
- [x] 6.5 验证旧格式兼容：读取不含 `analyzedIds` 的旧 `analysis.json`，确认不报错且正常运行
