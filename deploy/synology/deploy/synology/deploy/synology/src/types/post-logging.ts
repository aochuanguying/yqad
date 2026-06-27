/**
 * 发帖日志 - 类型定义
 */

import { PostingMode } from './posting-optimization';

/**
 * 发帖触发方式
 */
export type TriggerType = 'auto' | 'manual';

/**
 * 发帖类型：主题发帖/自由发帖
 */
export type PostType = 'topic' | 'free';

/**
 * 发帖日志记录
 */
export interface PostLog {
  id: string;                    // 日志 ID（UUID）
  timestamp: number;             // 发帖时间戳
  triggerType: TriggerType;      // 触发方式：auto=自动，manual=手动
  postType: PostType;            // 发帖类型：topic=主题发帖，free=自由发帖
  mode: PostingMode;             // 发帖模式：normal=普通，featured=精华
  topicId?: string;              // 主题 ID（如为主题发帖）
  topicName?: string;            // 主题名称（如为主题发帖）
  title: string;                 // 帖子标题
  content: string;               // 帖子内容
  imageUrls: string[];           // 图片 URL 列表
  status: 'success' | 'failed' | 'pending';  // 发帖状态（pending=等待回调）
  errorMessage?: string;         // 错误信息（如失败）
  taskId?: string;               // 任务 ID
  createdAt: number;             // 记录创建时间
}

/**
 * 日志查询请求参数
 */
export interface LogQueryParams {
  page?: number;                 // 页码（从 1 开始）
  limit?: number;                // 每页数量
  triggerType?: TriggerType | 'all';  // 触发方式筛选
  postType?: PostType | 'all';        // 发帖类型筛选
  startDate?: number;            // 开始时间戳
  endDate?: number;              // 结束时间戳
}

/**
 * 日志查询响应
 */
export interface LogQueryResponse {
  success: boolean;
  data: {
    logs: PostLog[];             // 当前页日志列表
    total: number;               // 总记录数
    page: number;                // 当前页码
    limit: number;               // 每页数量
    totalPages: number;          // 总页数
  };
  error?: string;
}

/**
 * 日志详情响应
 */
export interface LogDetailResponse {
  success: boolean;
  data?: PostLog;
  error?: string;
}
