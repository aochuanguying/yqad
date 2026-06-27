## 1. 项目准备和依赖安装

- [ ] 1.1 安装 `redis` npm 包（`npm install redis`）
- [ ] 1.2 安装加密库 `crypto-js`（`npm install crypto-js`）
- [ ] 1.3 更新 `package.json` 添加新依赖
- [ ] 1.4 创建存储层目录结构 `src/storage/redis/`

## 2. Redis 连接管理器实现

- [ ] 2.1 创建 `src/utils/redis-connection-manager.ts` 文件
- [ ] 2.2 实现 Redis 配置加载函数（支持环境变量覆盖）
- [ ] 2.3 实现连接池管理（最小 5 连接，最大 20 连接）
- [ ] 2.4 实现健康检查函数 `healthCheck()`
- [ ] 2.5 实现自动重连逻辑（最多 3 次，间隔 1 秒）
- [ ] 2.6 实现优雅关闭函数 `disconnect()`
- [ ] 2.7 实现键前缀处理函数（自动添加 `test:` 或 `prod:` 前缀）
- [ ] 2.8 编写连接管理器的单元测试

## 3. 环境配置管理实现

- [ ] 3.1 在 `config/default.yaml` 中添加 Redis 配置（test 和 production 环境）
- [ ] 3.2 创建环境变量验证逻辑（NODE_ENV、REDIS_HOST、REDIS_PORT、REDIS_DB）
- [ ] 3.3 实现配置验证函数（检查必需字段、数据库编号范围）
- [ ] 3.4 实现启动时 Redis 连接测试
- [ ] 3.5 编写环境配置的单元测试

## 4. 主题可用次数存储实现

- [ ] 4.1 创建 `src/storage/redis/topic-uses-storage.ts` 文件
- [ ] 4.2 实现 `setUses(topicId, uses)` 函数（SET + EXPIRE 7 天）
- [ ] 4.3 实现 `getUses(topicId)` 函数（GET）
- [ ] 4.4 实现 `incrementUses(topicId, delta)` 函数（INCRBY）
- [ ] 4.5 实现 `decrementUses(topicId, delta)` 函数（INCRBY，确保非负）
- [ ] 4.6 实现降级到内存 Map 的逻辑
- [ ] 4.7 编写主题可用次数存储的单元测试和集成测试

## 5. 敏感词库存储实现

- [ ] 5.1 创建 `src/storage/redis/sensitive-words-storage.ts` 文件
- [ ] 5.2 实现 `addWord(word)` 函数（SADD）
- [ ] 5.3 实现 `removeWord(word)` 函数（SREM）
- [ ] 5.4 实现 `contains(word)` 函数（SISMEMBER）
- [ ] 5.5 实现 `getAllWords()` 函数（SMEMBERS）
- [ ] 5.6 实现 `importWords(words[])` 函数（Pipeline 批量导入）
- [ ] 5.7 实现 Redis Pub/Sub 热更新监听
- [ ] 5.8 实现 `reloadWordLibrary()` 函数（发布更新通知）
- [ ] 5.9 编写敏感词库存储的单元测试和集成测试

## 6. API Token 存储实现

- [ ] 6.1 创建 `src/storage/redis/api-token-storage.ts` 文件
- [ ] 6.2 实现 Token 加密函数（AES-256-GCM）
- [ ] 6.3 实现 Token 解密函数
- [ ] 6.4 实现 `saveToken(token, options)` 函数（SET + 加密 + TTL）
- [ ] 6.5 实现 `getToken()` 函数（GET + 解密）
- [ ] 6.6 实现 `deleteToken()` 函数（DEL）
- [ ] 6.7 实现 `hasToken()` 函数（EXISTS）
- [ ] 6.8 编写 API Token 存储的单元测试和集成测试

## 7. 任务缓存存储实现

- [ ] 7.1 创建 `src/storage/redis/task-cache-storage.ts` 文件
- [ ] 7.2 实现 `saveTask(taskId, task)` 函数（HSET + EXPIRE 30 分钟）
- [ ] 7.3 实现 `getTask(taskId)` 函数（HGETALL + 反序列化）
- [ ] 7.4 实现 `updateTaskStatus(taskId, status)` 函数（HSET 单字段）
- [ ] 7.5 实现 `deleteTask(taskId)` 函数（DEL）
- [ ] 7.6 实现 `hasTask(taskId)` 函数（EXISTS）
- [ ] 7.7 编写任务缓存存储的单元测试和集成测试

## 8. 业务层适配 - 主题服务

- [ ] 8.1 修改 `src/web/services/topics-service.ts` 导入 Redis 存储模块
- [ ] 8.2 替换内存 Map 为 Redis `topic-uses-storage`
- [ ] 8.3 修改 `getAvailableTopicCount()` 函数使用 Redis 查询
- [ ] 8.4 修改 `incrementUseCount()` 函数调用 Redis increment
- [ ] 8.5 修改 `decrementUseCount()` 函数调用 Redis decrement
- [ ] 8.6 添加降级逻辑测试
- [ ] 8.7 编写主题服务的集成测试

## 9. 业��层适配 - 发帖路由

- [ ] 9.1 修改 `src/web/routes/posts-routes.ts` 导入 Redis 存储模块
- [ ] 9.2 替换内存 Map 为 Redis `task-cache-storage`
- [ ] 9.3 修改发帖端点使用 Redis 保存任务
- [ ] 9.4 修改任务查询端点使用 Redis 获取任务
- [ ] 9.5 修改任务状态更新端点使用 Redis 更新
- [ ] 9.6 添加任务过期清理日志
- [ ] 9.7 编写发帖路由的集成测试

## 10. 业务层适配 - 敏感词过滤器

- [ ] 10.1 修改 `src/services/sensitive-word-filter-service.ts` 导入 Redis 存储模块
- [ ] 10.2 修改词库加载函数从 Redis 读取
- [ ] 10.3 修改 `detectSensitiveWords()` 使用 Redis 词库
- [ ] 10.4 修改敏感词添加/删除 API 同步到 Redis
- [ ] 10.5 实现词库热更新监听
- [ ] 10.6 编写敏感词过滤器的集成测试

## 11. 业务层适配 - API Token 工具

- [ ] 11.1 修改 `src/utils/api-token.ts` 导入 Redis 存储模块
- [ ] 11.2 修改 Token 生成函数保存到 Redis
- [ ] 11.3 修改 Token 读取函数从 Redis 读取
- [ ] 11.4 修改 Token 验证函数使用 Redis 查询
- [ ] 11.5 实现 Token 加密密钥配置（`TOKEN_ENCRYPTION_KEY` 环境变量）
- [ ] 11.6 编写 API Token 工具的集成测试

## 12. Redis 持久化配置

- [ ] 12.1 创建 Redis 配置文件 `redis/redis.conf`
- [ ] 12.2 配置 RDB 持久化（save 规则：900 1, 300 10, 60 10000）
- [ ] 12.3 配置 AOF 持久化（fsync: everysec）
- [ ] 12.4 配置最大内存限制（maxmemory 512mb）
- [ ] 12.5 配置内存淘汰策略（maxmemory-policy allkeys-lru）
- [ ] 12.6 在 Docker Compose 中挂载 Redis 配置文件
- [ ] 12.7 测试持久化功能（重启验证数据不丢失）

## 13. 测试和验证

- [ ] 13.1 本地开发环境测试（连接 192.168.50.50:6379）
- [ ] 13.2 测试环境隔离验证（test DB 0 vs prod DB 1）
- [ ] 13.3 性能测试（对比原内存/文件存储方案）
- [ ] 13.4 持久化测试（重启后验证数据完整性）
- [ ] 13.5 降级策略测试（Redis 不可用时验证降级到内存）
- [ ] 13.6 并发测试（多线程同时读写验证原子性）
- [ ] 13.7 编写端到端测试（完整业务流程）

## 14. 文档和部署准备

- [ ] 14.1 更新 README.md 添加 Redis 依赖说明
- [ ] 14.2 创建部署文档（Docker Compose 配置、网络设置）
- [ ] 14.3 创建运维手册（监控指标、备份策略、故障排查）
- [ ] 14.4 更新环境变量说明文档
- [ ] 14.5 创建回滚操作文档

## 15. 生产部署

- [ ] 15.1 生产环境 Redis 容器配置（加入 bridge 网络）
- [ ] 15.2 应用容器重新创建（加入 bridge 网络）
- [ ] 15.3 灰度发布（10% 流量）
- [ ] 15.4 监控 Redis 连接状态、内存使用、延迟
- [ ] 15.5 全量发布（100% 流量）
- [ ] 15.6 验证所有功能正常运行
