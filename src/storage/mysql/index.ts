/**
 * MySQL 存储模块导出
 */

// 连接管理器
export {
  getMySQLConnectionManager,
  initializeMySQL,
  getMySQLIfExists,
} from '../../utils/mysql-connection-manager';

// DAO 基类
export { BaseDAO } from './dao/base-dao';

// 会员存储
export {
  MemberStorage,
  getMemberStorage,
  type Member,
  type CreateMemberInput,
  type UpdateMemberInput,
} from './member-storage';

// 帖子存储
export {
  PostStorage,
  getPostStorage,
  type Post,
  type CreatePostInput,
  type UpdatePostInput,
} from './post-storage';

// 评论存储
export {
  CommentStorage,
  getCommentStorage,
  type Comment,
  type CreateCommentInput,
  type UpdateCommentInput,
} from './comment-storage';

// 发帖日志存储
export {
  PostLogStorage,
  getPostLogStorage,
  type PostLog,
  type CreatePostLogInput,
  type PostLogQueryOptions,
} from './post-log-storage';

// 待确认发帖存储
export {
  PendingPostStorage,
  getPendingPostStorage,
  type PendingPost,
  type CreatePendingPostInput,
} from './pending-post-storage';

// 主题存储
export {
  TopicStorage,
  getTopicStorage,
  type Topic,
  type TopicSubDirection,
  type CreateTopicInput,
} from './topic-storage';

// 素材记录存储
export {
  MaterialRecordStorage,
  getMaterialRecordStorage,
  type MaterialRecord,
  type CreateMaterialRecordInput,
} from './material-record-storage';

// 主题使用记录存储
export {
  TopicUsageStorage,
  getTopicUsageStorage,
  type SubDirectionUsageRecord,
  type MaterialUsageRecord,
  type SubDirectionUsageInput,
  type MaterialUsageInput,
} from './topic-usage-storage';

// 每日摘要存储
export {
  DailySummaryStorage,
  getDailySummaryStorage,
  type DailySummary,
  type CreateDailySummaryInput,
} from './daily-summary-storage';
