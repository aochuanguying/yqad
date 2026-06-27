## 1. 基础设施准备

- [x] 1.1 安装 mysql2 npm 包
- [x] 1.2 创建 MySQL 连接���理器（mysql-connection-manager.ts）
- [x] 1.3 实现连接池配置管理（测试/生产环境）
- [x] 1.4 实现事务管理工具类
- [x] 1.5 实现健康检查接口
- [x] 1.6 编写连接管理器单元测试

## 2. 数据库迁移

- [x] 2.1 创建 schema_migrations 表迁移脚本
- [x] 2.2 创建 members 表迁移脚本（001_create_members_table.sql）
- [x] 2.3 创建 posts 表迁移脚本（002_create_posts_table.sql）
- [x] 2.4 创建 comments 表迁移脚本（003_create_comments_table.sql）
- [x] 2.5 创建索引迁移脚本（004_create_indexes.sql）
- [x] 2.6 实现迁移执行器（执行 Up/Down 迁移）
- [x] 2.7 实现迁移状态查询命令
- [x] 2.8 创建管理员账号种子脚本
- [x] 2.9 本地测试环境执行迁移验证

## 3. 会员信息存储实现

- [x] 3.1 创建 MemberStorage 类（src/storage/mysql/member-storage.ts）
- [x] 3.2 实现 createMember 方法（创建会员）
- [x] 3.3 实现 getMemberById 方法（查询会员）
- [x] 3.4 实现 updateMember 方法（更新会员）
- [x] 3.5 实现 updateMemberLevel 方法（更新会员等级）
- [x] 3.6 实现 deleteMember 方法（软删除会员）
- [x] 3.7 实现 queryMembers 方法（分页查询）
- [x] 3.8 实现 authenticate 方法（登录验证）
- [x] 3.9 实现 refreshToken 方法（Token 刷新）
- [x] 3.10 编写会员存储集成测试

## 4. 帖子数据存储实现

- [x] 4.1 创建 PostStorage 类（src/storage/mysql/post-storage.ts）
- [x] 4.2 实现 createPost 方法（创建帖子）
- [x] 4.3 实现 getPostById 方法（查询帖子详情）
- [x] 4.4 实现 updatePost 方法（更新帖子）
- [x] 4.5 实现 publishPost 方法（发布帖子）
- [x] 4.6 实现 deletePost 方法（软删除帖子）
- [x] 4.7 实现 queryPosts 方法（分页查询列表）
- [x] 4.8 实现 incrementViewCount 方法（增加浏览计数）
- [x] 4.9 实现 incrementLikeCount 方法（增加点赞计数）
- [x] 4.10 实现 incrementCommentCount 方法（增加评论计数）
- [x] 4.11 编写帖子存储集成测试

## 5. 评论数据存储实现

- [x] 5.1 创建 CommentStorage 类（src/storage/mysql/comment-storage.ts）
- [x] 5.2 实现 createComment 方法（创建评论）
- [x] 5.3 实现 getCommentById 方法（查询评论详情）
- [x] 5.4 实现 getCommentsByPostId 方法（查询帖子评论列表）
- [x] 5.5 实现 updateComment 方法（更新评论）
- [x] 5.6 实现 deleteComment 方法（软删除评论）
- [x] 5.7 实现 approveComment 方法（审核评论）
- [x] 5.8 实现 rejectComment 方法（拒���评论）
- [x] 5.9 实现 getCommentTree 方法（查询评论树）
- [x] 5.10 编写评论存储集成测试

## 6. 数据访问层（DAO）实现

- [x] 6.1 创建 DAO 基类（src/storage/mysql/dao/base-dao.ts）
- [x] 6.2 实现通用 CRUD 接口
- [x] 6.3 实现事务管理辅助方法
- [x] 6.4 实现分页查询辅助方法
- [x] 6.5 实现查询构建器工具类
- [x] 6.6 编写 DAO 单元测试

## 7. 业务层适配

- [x] 7.1 修改 auth-service 从 MySQL 加载会员信息
- [x] 7.2 修改 auth-service 使用 MySQL 验证登录
- [x] 7.3 修改 member-service 使用 MySQL 存储
- [x] 7.4 修改 post-service 使用 MySQL 存储
- [x] 7.5 修改 comment-service 使用 MySQL 存储
- [x] 7.6 实现降级逻辑（MySQL 不可用时降级到 Redis）
- [x] 7.7 实现缓存同步（MySQL → Redis）
- [x] 7.8 编写业务层集成测试

## 8. 配置文件更新

- [x] 8.1 更新 config/default.yaml 添加 MySQL 配置
- [x] 8.2 添加环境变量示例（.env.example）
- [x] 8.3 更新 Docker Compose 配置（添加 MySQL 容器）
- [x] 8.4 更新 Dockerfile（安装 MySQL 客户端依赖）
- [x] 8.5 创建本地开发环境配置说明

## 9. 测试验证

- [x] 9.1 本地开发环境测试（连接 localhost:3306）
- [x] 9.2 测试环境隔离验证（test vs prod 数据库）
- [x] 9.3 性能测试（对比原方案）
- [x] 9.4 事务测试（并发场景）
- [x] 9.5 降级策略测试（MySQL 不可用场景）
- [x] 9.6 迁移脚本测试（升级/回滚）
- [x] 9.7 外键约束测试（级联删除）
- [x] 9.8 编写端到端测试

## 10. 文档和部署

- [x] 10.1 编写 MySQL 部署文档
- [x] 10.2 编写数据库迁移操作手册
- [x] 10.3 编写备份恢复操作手册
- [x] 10.4 编写监控告警配置说明
- [x] 10.5 更新 README.md（添加 MySQL 使用说明）
- [x] 10.6 生产环境 MySQL 配置
- [x] 10.7 应用容器加入 MySQL 网络
- [x] 10.8 执行生产数据库迁移
- [x] 10.9 灰度发布（10% 流量）
- [x] 10.10 全量发布 + 监控
