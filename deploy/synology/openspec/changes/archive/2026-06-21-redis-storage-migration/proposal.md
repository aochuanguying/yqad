## 为什么

当前项目从零开始，尚未使用任何数据库存储。关键数据（主题可用次数、敏感词库、API Token、任务缓存）如果仅使用内存 Map 或 JSON 文件存储，会导致以下问题：

1. **数据易失性**：应用重启导致内存数据完全丢失
2. **文件锁竞争**：JSON 文件读写存在并发锁问题
3. **性能瓶颈**：文件 IO 性能低于内存数据库
4. **环境隔离缺失**：测试和生产环境共用同一份文件，容易数据混乱

本项目采用"三步走"数据库战略：
- **第一步（本次）**：只使用 Redis 存储（从零开始实现）
- 第二步：引入 MySQL 存储
- 第三步：引入 ChromaDB 向量数据库

本次变更是三步走战略的第一步，专注于从零开始实现 Redis 存储系统。

## 变更内容

1. **从零实现 Redis 存储层** - 引入 Redis 客户端和连接池管理，支持测试环境（IP 通信）和生产环境（容器内通信）的不同配置
2. **实现主题可用次数 Redis 存储** - 使用 Redis String 或 Hash 存储 `Map<string, number>`，支持持久化和 TTL 自动过期
3. **实现敏感词库 Redis 存储** - 使用 Redis Set 存储敏感词，实现快速查询和热更新
4. **实现 API Token Redis 存储** - 使用 Redis String 存储 Token，支持加密存储
5. **实现任务缓存 Redis 存储** - 使用 Redis Hash 存储 `Map<string, AsyncTask>`，带 TTL 自动清理
6. **实现环境配置管理** - 区分测试环境（192.168.50.50）和生产环境（容器内通信）的数据库连接配置
7. **配置 Redis 持久化** - 配置 RDB/AOF 持久化策略，确保重启后数据不丢失

## 功能 (Capabilities)

### 新增功能
- `redis-connection-manager`: Redis 连接管理模块，支持测试/生产环境配置切换、连接池管理、健康检查
- `topic-uses-storage`: 主题可用次数的 Redis 存储，使用 String 或 Hash 数据结构，支持 TTL 和原子操作
- `sensitive-words-storage`: 敏感词库的 Redis 存储，使用 Set 数据结构，支持批量操作和热更新
- `api-token-storage`: API Token 的 Redis 存储，使用 String 数据结构，支持加密存储
- `task-cache-storage`: 任务缓存的 Redis 存储，使用 Hash 数据结构，带 TTL 自动过期
- `environment-config`: 环境配置管理，区分测试环境（IP 通信）和生产环境（容器内通信）

### 修改功能
- `topics-service`: 主题服务修改为使用 Redis 存储可用次数，替代内存 Map 存储
- `posts-routes`: 发帖路由修改为使用 Redis 任务缓存，替代内存 Map 存储
- `sensitive-word-filter`: 敏感词过滤器修改为从 Redis 加载词库，替代 JSON 文件读取
- `api-token`: API Token 工具修改为使用 Redis 存储，替代 JSON 文件存储

## 影响

### 代码影响
- **新增文件**: 
  - `src/utils/redis-connection-manager.ts` - Redis 连接管理
  - `src/storage/redis/topic-uses-storage.ts` - 主题可用次数存储
  - `src/storage/redis/sensitive-words-storage.ts` - 敏感词库存储
  - `src/storage/redis/api-token-storage.ts` - API Token 存储
  - `src/storage/redis/task-cache-storage.ts` - 任务缓存存储
- **修改文件**:
  - `src/web/services/topics-service.ts` - 适配 Redis 存储
  - `src/web/routes/posts-routes.ts` - 适配 Redis 任务缓存
  - `src/services/sensitive-word-filter-service.ts` - 适配 Redis 词库
  - `src/utils/api-token.ts` - 适配 Redis Token 存储
  - `config/default.yaml` - 新增 Redis 连接配置

### 依赖影响
- **新增依赖**: `redis` npm 包（Redis 客户端）
- **数据库依赖**: Redis 7.0+（本机已有环境）

### 系统影响
- **测试环境**: 使用宿主机 IP `192.168.50.50:6379` 访问 Redis
- **生产环境**: 使用容器名 `redis:6379` 访问（需加入 bridge 网络）
- **数据库隔离**: 测试和生产使用不同的 Redis 数据库编号（test: DB 0, prod: DB 1）防止数据混乱
- **持久化**: 配置 RDB 快照 + AOF 日志，确保重启后数据不丢失

### 运维影响
- **容器网络**: 应用容器需加入 `bridge` 网络与 Redis 容器通信
- **备份策略**: Redis 需配置定期持久化
- **监控**: 新增 Redis 连接状态、内存使用、命中率等监控指标
