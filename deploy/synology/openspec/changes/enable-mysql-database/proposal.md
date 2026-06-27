## 为什么

当前项目已完成 Redis 存储迁移，实现了主题可用次数、敏感词库、API Token、任务缓存的 Redis 存储。然而，Redis 作为内存数据库，主要适用于缓存和临时数据存储，对于需要持久化、复杂查询和关系型数据结构的业务数据（如会员信息、帖子内容、评论记录等）并不适合。

引入 MySQL 数据库的必要性：

1. **持久化存储需求**：会员信息、帖子数据等核心业务数据需要可靠的持久化存储
2. **复杂查询能力**：MySQL 支持复杂的 SQL 查询、JOIN 操作，适合多维度数据检索
3. **关系型数据结构**：用户 - 帖子 - 评论之间的关联关系天然适合关系型数据库
4. **事务支持**：关键业务操作需要 ACID 事务保证数据一致性
5. **数据完整性**：外键约束、唯一索引等机制保障数据完整性

本项目采用"三步走"数据库战略：
- **第一步（已完成）**：Redis 存储系统（缓存、临时数据）
- **第二步（本次）**：引入 MySQL 存储（核心业务数据）
- **第三步**：引入 ChromaDB 向量数据库（语义搜索、推荐系统）

本次变更是三步走战略的第二步，专注于启用 MySQL 数据库存储核心业务数据。

## 变更内容

1. **实现 MySQL 连接管理** - 引入 MySQL 客户端和连接池管理，支持测试/生产环境配置
2. **实现会员信息 MySQL 存储** - 使用 MySQL 表存储会员信息、权限等级、有效期等
3. **实现帖子数据 MySQL 存储** - 使用 MySQL 表存储帖子内容、元数据、状态等
4. **实现评论数据 MySQL 存储** - 使用 MySQL 表存储评论记录、关联关系等
5. **实现数据访问层 (DAO)** - 为每个数据表创建 CRUD 操作接口
6. **实现数据库迁移脚本** - 初始化数据库表结构、索引、约束等
7. **实现环境配置管理** - 区分测试环境和生产环境的 MySQL 连接配置

## 功能 (Capabilities)

### 新增功能
- `mysql-connection-manager`: MySQL 连接管理模块，支持连接池、事务管理、健康检查
- `member-storage`: 会员信息的 MySQL 存储，包括用户基本信息、权限、有效期等
- `post-storage`: 帖子数据的 MySQL 存储，包括内容、元数据、状态等
- `comment-storage`: 评论数据的 MySQL 存储，包括评论内容、关联关系等
- `database-migration`: 数据库迁移脚本，初始化表结构、索引、约束
- `data-access-layer`: 数据访问层 (DAO)，提供统一的 CRUD 操作接口

### 修改功能
- `auth-service`: 认证服务修改为从 MySQL 加载会员信息和权限
- `member-service`: 会员服务修改为使用 MySQL 存储，替代 Redis 存储
- `post-service`: 帖子服务修改为使用 MySQL 存储，替代内存/文件存储
- `comment-service`: 评论服务修改为使用 MySQL 存储

## 影响

### 代码影响
- **新增文件**: 
  - `src/utils/mysql-connection-manager.ts` - MySQL 连接管理
  - `src/storage/mysql/member-storage.ts` - 会员信息存储
  - `src/storage/mysql/post-storage.ts` - 帖子数据存储
  - `src/storage/mysql/comment-storage.ts` - 评论数据存储
  - `src/storage/mysql/dao/` - 数据访问层接口
  - `src/db/migrations/` - 数据库迁移脚本
- **修改文件**:
  - `src/services/auth.ts` - 从 MySQL 加载会员信息
  - `src/services/member-service.ts` - 适配 MySQL 存储
  - `src/services/post-service.ts` - 适配 MySQL 存储
  - `config/default.yaml` - 新增 MySQL 连接配置

### 依赖影响
- **新增依赖**: `mysql2` npm 包（MySQL 客户端）
- **数据库依赖**: MySQL 8.0+（需安装或已有环境）

### 系统影响
- **测试环境**: 使用本地 MySQL 服�� `localhost:3306` 或 Docker 容器
- **生产环境**: 使用容器网络内的 MySQL 服务
- **数据库隔离**: 测试和生产使用不同的数据库名称防止数据混乱
- **持久化**: MySQL 天然持久化，配置定期备份策略

### 运维影响
- **容器网络**: 应用容器需与 MySQL 容器在同一网络
- **备份策略**: MySQL 需配置定期全量/增量备份
- **监控**: 新增 MySQL 连接数、查询性能、慢查询等监控指标
- **迁移管理**: 数据库表结构变更需通过迁移脚本管理
