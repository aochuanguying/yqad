## 上下文

当前项目已完成 Redis 存储迁移，实现了主题可用次数、敏感词库、API Token、任务缓存的 Redis 存储。然而，Redis 作为内存数据库，主要适用于缓存和临时数据存储，对于需要持久化、复杂查询和关系型数据结构的业务数据（如会员信息、帖子内容、评论记录等）并不适合。

**当前状态**：
- Redis 存储：主题可用次数、敏感词库、API Token、任务缓存
- 内存/文件存储：会员信息、帖子数据、评论数据（尚未持久化）

**约束条件**：
- 已有 Redis 存储系统（第一步已完成）
- 测试环境使用 Docker 容器或本地 MySQL 服务
- 生产环境使用容器网络内的 MySQL 服务
- 测试和生产使用不同的数据库名称防止数据混乱
- 必须支持事务和 ACID 特性

## 目标 / 非目标

**目标：**
1. 实现 MySQL 连接管理（连接池、事务管理、健康检查）
2. 实现会员信息、帖子数据、评论数据的 MySQL 存储
3. 实现数据访问层（DAO）提供统一的 CRUD 操作接口
4. 实现数据库迁移脚本管理表结构变更
5. 实现测试/生产环境隔离的配置管理
6. 保持向后兼容，不影响现有业务逻辑
7. 提供降级方案（MySQL 不可用时回退到 Redis/内存存储）

**非目标：**
1. 迁移 Redis 数据到 MySQL（数据类型不同，无需迁移）
2. 使用 ChromaDB 向量数据库（第三步才引入）
3. 修改业务逻辑（仅变更存储层）
4. 性能优化（保持现有性能或更好）
5. 替换 Redis 存储（Redis 仍用于缓存和临时数据）

## 决策

### 1. MySQL 表结构设计

**决策**：采用规范化设计，支持外键约束和索引优化

**会员表 (members)**：
```sql
CREATE TABLE members (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  member_level ENUM('free', 'basic', 'premium', 'vip') DEFAULT 'free',
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_member_level (member_level),
  INDEX idx_expires_at (expires_at)
);
```

**帖子表 (posts)**：
```sql
CREATE TABLE posts (
  id VARCHAR(64) PRIMARY KEY,
  member_id VARCHAR(64) NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  status ENUM('draft', 'published', 'deleted') DEFAULT 'draft',
  view_count INT DEFAULT 0,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_member_id (member_id),
  INDEX idx_status (status),
  INDEX idx_published_at (published_at)
);
```

**评论表 (comments)**：
```sql
CREATE TABLE comments (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) NOT NULL,
  member_id VARCHAR(64) NOT NULL,
  parent_id VARCHAR(64),
  content TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'deleted') DEFAULT 'approved',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
  INDEX idx_post_id (post_id),
  INDEX idx_member_id (member_id),
  INDEX idx_parent_id (parent_id)
);
```

**考虑过的替代方案**：
- 使用 JSON 字段存储非结构化数据：灵活性高但查询性能差
- 使用宽表设计：减少 JOIN 但数据冗余严重
- 不使用外键约束：应用层维护一致性，增加复杂度

**选择理由**：规范化设计保证数据一致性，外键约束自动维护关联关系，索引优化查询性能。

### 2. 连接池管理

**决策**：使用 `mysql2/promise` 连接池，配置合理的连接参数

```typescript
// mysql-connection-manager.ts
const poolConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'yqad_dev',
  waitForConnections: true,
  connectionLimit: 10,        // 最大连接数
  queueLimit: 0,              // 无限制队列
  enableKeepAlive: true,      // 保持长连接
  keepAliveInitialDelay: 0,   // 立即启用
  connectTimeout: 10000,      // 连接超时 10 秒
  acquireTimeout: 30000,      // 获取连接超时 30 秒
  timeout: 30000,             // 查询超时 30 秒
};
```

**考虑过的替代方案**：
- 单连接模式：无法并发，性能差
- 无限制连接池：可能导致数据库过载
- 使用第三方 ORM（Sequelize、TypeORM）：增加依赖和复杂度

**选择理由**：`mysql2/promise` 提供原生 Promise API，连接池配置平衡性能和资源消耗。

### 3. 事务管理

**决策**：使用显式事务管理关键业务操作

```typescript
// 示例：发帖事务
async createPost(memberId: string, title: string, content: string): Promise<Post> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // 1. 创建帖子
    const [result] = await conn.execute(
      'INSERT INTO posts (member_id, title, content, status) VALUES (?, ?, ?, ?)',
      [memberId, title, content, 'published']
    );
    
    // 2. 更新会员发帖计数
    await conn.execute(
      'UPDATE members SET post_count = post_count + 1 WHERE id = ?',
      [memberId]
    );
    
    // 3. 更新 Redis 缓存
    await invalidateMemberCache(memberId);
    
    await conn.commit();
    return { id: result.insertId, memberId, title, content };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
```

**考虑过的替代方案**：
- 自动提交模式：无法保证多操作原子性
- 应用层补偿：复杂且容易出错
- 不使用事务：数据一致性无法保证

**选择理由**：显式事务保证 ACID 特性，失败自动回滚，数据一致性强。

### 4. 环境配置管理

**决策**：使用配置文件 + 环境变量覆盖

```yaml
# config/default.yaml
mysql:
  # 测试环境配置
  test:
    host: localhost
    port: 3306
    user: root
    password: ${MYSQL_PASSWORD}
    database: yqad_test
    connectionLimit: 5
  
  # 生产环境配置
  production:
    host: mysql
    port: 3306
    user: yqad
    password: ${MYSQL_PASSWORD}
    database: yqad_prod
    connectionLimit: 10
```

**环境变量**：
- `NODE_ENV`: 区分环境（test / production）
- `MYSQL_HOST`: 覆盖默认主机
- `MYSQL_PORT`: 覆盖默认端口
- `MYSQL_USER`: 覆盖默认用户
- `MYSQL_PASSWORD`: 数据库密码（必填）
- `MYSQL_DATABASE`: 覆盖默认数据库名

**考虑过的替代方案**：
- 使用不同配置文件：维护成本高
- 使用配置中心：过度设计
- 硬编码在代码中：缺乏灵活性

**选择理由**：配置文件 + 环境变量覆盖提供最佳灵活性，符合 12-Factor App 原则。

### 5. 数据库迁移管理

**决策**：使用 SQL 脚本管理迁移，版本控制

```
src/db/migrations/
├── 001_create_members_table.sql
├── 002_create_posts_table.sql
├── 003_create_comments_table.sql
├── 004_add_member_post_count.sql
└── ...
```

**迁移脚本示例**：
```sql
-- 001_create_members_table.sql
-- +migrate Up
CREATE TABLE IF NOT EXISTS members (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  -- ... 其他字段
);

-- +migrate Down
DROP TABLE IF EXISTS members;
```

**考虑过的替代方案**：
- 使用迁移工具（db-migrate、sequelize-cli）：增加依赖
- 手动执行 SQL：容易遗漏，无版本控制
- 应用启动时自动建表：生产环境风险大

**选择理由**：SQL 脚本简单直接，版本控制清晰，易于审查和回滚。

### 6. 降级策略

**决策**：实现 MySQL 不可用时的优雅降级

```typescript
// 伪代码示例
class MemberStorage {
  private useMySQL: boolean = true;
  
  async getMember(memberId: string): Promise<Member | null> {
    try {
      if (this.useMySQL) {
        return await mysql.query('SELECT * FROM members WHERE id = ?', [memberId]);
      }
    } catch (error) {
      logger.warn('MySQL 不可用，降级到 Redis 缓存', error);
      this.useMySQL = false;
    }
    
    // 降级到 Redis 缓存
    const cached = await redis.get(`member:${memberId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 最终降级：返回 null
    return null;
  }
}
```

**降级层级**：
1. MySQL 主存储
2. Redis 缓存（只读）
3. 内存缓存（只读）
4. 返回 null（写操作失败）

**考虑过的替代方案**：
- 直接抛出异常：影响业务可用性
- 仅使用 MySQL：单点故障风险
- 自动重试：可能加重 MySQL 负担

**选择理由**：多层降级保证业务连续性，同时记录告警日志。

### 7. 初始化策略

**决策**：启动时初始化 MySQL 连接和执行迁移

```typescript
// 启动流程
1. 加载环境配置（NODE_ENV、MYSQL_HOST 等）
2. 创建 MySQL 连接池
3. 测试 MySQL 连接
4. 检查并执行数据库迁移
5. 初始化各存储模块（member, post, comment）
6. 继续正常业务流程
```

**考虑过的替代方案**：
- 懒加载连接：首次使用时才连接，延迟问题发现
- 手动迁移：增加运维复杂度
- 应用启动后手动执行迁移：容易遗漏

**选择理由**：启动时初始化可以尽早发现问题，自动迁移确保表结构最新。

## 风险 / 权衡

### [风险] MySQL 单点故障
**风险**：MySQL 宕机导致存储层不可用

**缓解措施**：
- 实现多层降级策略（MySQL → Redis → 内存）
- 生产环境配置 MySQL 主从复制（未来）
- 健康检查 + 自动告警
- 连接池自动重连

### [风险] 连接池耗尽
**风险**：高并发时连接池耗尽，请求排队

**缓解措施**：
- 设置合理的 connectionLimit（测试 5，生产 10）
- 监控活跃连接数和队列长度
- 查询超时自动终止（30 秒）
- 慢查询日志分析和优化

### [风险] 数据库迁移失败
**风险**：迁移脚本错误导致启动失败

**缓解措施**：
- 迁移前备份数据库
- 迁移脚本幂等性设计（IF NOT EXISTS）
- 迁移失败自动回滚
- 本地测试环境充分验证

### [风险] SQL 注入攻击
**风险**：恶意用户通过 SQL 注入攻击数据库

**缓解措施**：
- 使用参数化查询（Prepared Statements）
- 禁止拼接 SQL 字符串
- 输入验证和过滤
- 最小权限原则（应用账号仅必要权限）

### [风险] 性能下降
**风险**：MySQL 查询性能低于内存/Redis

**缓解措施**：
- 热点数据使用 Redis 缓存
- 添加合适的索引优化查询
- 慢查询监控和优化
- 分页查询避免大数据集

### [风险] 数据一致性
**风险**：MySQL 和 Redis 数据不一致

**缓解措施**：
- MySQL 作为主存储
- 写操作先更新 MySQL，再删除 Redis 缓存
- 定期一致��检查任务
- 缓存过期时间设置合理

### [权衡] 增加系统复杂度
**权衡**：引入 MySQL 增加架构复杂度和运维成本

**理由**：
- 换取数据持久性和可靠性
- 换取复杂查询能力
- 换取事务支持
- 换取关系型数据结构
- 复杂度在可控范围内（仅 3 个核心表）

## 实施计划

### 阶段 1：基础设施准备
1. 安装 `mysql2` npm 包
2. 实现 MySQL 连接管理器
3. 配置测试/生产环境连接
4. 编写单元测试

### 阶段 2：数据库迁移
1. 编写会员表迁移脚本
2. 编写帖子表迁移脚本
3. 编写评论表迁移脚本
4. 执行迁移并验证

### 阶段 3：存储层实现
1. 实现会员信息存储（MemberStorage）
2. 实现帖子数据存储（PostStorage）
3. 实现评论数据存储（CommentStorage）
4. 实现数据访问层（DAO）
5. 编写集成测试

### 阶段 4：业务层适配
1. 修改 auth-service 从 MySQL 加载会员信息
2. 修改 member-service 使用 MySQL 存储
3. 修改 post-service 使用 MySQL 存储
4. 修改 comment-service 使用 MySQL 存储
5. 实现降级逻辑

### 阶段 5：测试验证
1. 本地开发环境测试（连接 localhost:3306）
2. 测试环境隔离验证（test vs prod 数据库）
3. 性能测试（对比原方案）
4. 事务测试（并发场景）
5. 降级策略测试

### 阶段 6：生产部署
1. 生产环境 MySQL 配置
2. 应用容器加入 MySQL 网络
3. 执行生产数据库迁移
4. 灰度发布（10% 流量）
5. 全量发布 + 监控

## 回滚策略

### 回滚触发条件
- MySQL 连接成功率 < 95%
- 查询 P99 延迟 > 500ms
- 数据错误率 > 1%
- 事务失败率 > 5%

### 回滚步骤
1. **快速回滚**：切换环境变量 `USE_MYSQL=false`
2. **数据导出**：从 MySQL 导出数据到文件
3. **应用回滚**：部署上一个稳定版本
4. **验证**：确认业务恢复正常

### 回滚时间目标
- 检测时间：< 5 分钟
- 决策时间：< 5 分钟
- 执行时间：< 15 分钟
- **总时间**：< 25 分钟

## 开放问题

1. **MySQL 主从复制**：未来读流量增长后是否需要读写分离？
   - 当前方案：单机 MySQL
   - 触发条件：CPU 使用率 > 70% 持续 1 周

2. **监控告警**：使用什么监控工具？
   - 选项 A：Prometheus + Grafana
   - 选项 B：MySQL Enterprise Monitor
   - 待定：等待运维团队建议

3. **备份策略**：MySQL 备份频率？
   - 建议：每天凌晨 2 点全量备份到 NAS
   - 建议：每小时增量备份 binlog
   - 待定：与运维团队确认备份窗口
