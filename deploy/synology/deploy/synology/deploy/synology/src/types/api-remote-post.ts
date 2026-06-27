/**
 * 远程发帖 API - 类型定义
 */

import { MatchedTopic, PostingMode } from './posting-optimization';

/**
 * 图片元数据信息
 */
export interface ImageInfo {
  url: string;               // 下载 URL
  relativePath: string;      // 相对路径
  filename: string;          // 文件名
  size?: number;             // 文件大小（字节）
}

/**
 * 发帖内容生成请求
 */
export interface GeneratePostRequest {
  useTopic?: boolean;        // 是否使用预配置主题（默认 true）
  mode?: PostingMode;        // 发帖模式：'featured' | 'normal'
  topicId?: string;          // 指定主题 ID（可选）
}

/**
 * 发帖内容生成响应
 */
export interface GeneratePostResponse {
  success: boolean;
  data?: {
    taskId: string;          // 待确认记录 ID，客户端发布后需回调
    title: string;           // 帖子标题
    content: string;         // 帖子正文
    images: ImageInfo[];     // 图片信息列表
    mode: PostingMode;       // 发帖模式
    topics?: MatchedTopic[]; // 推荐话题（0-5 个）
    metadata: {
      topicId?: string;      // 使用的主题 ID
      topicTitle?: string;   // 主题标题
      subDirectionIndex?: number; // 子方向索引
      generatedAt: string;   // 生成时间
    };
  };
  error?: string;
  code?: string;
}

/**
 * 批量发帖任务请求
 */
export interface BatchPostRequest {
  count: number;             // 生成数量（1-5）
  useTopic?: boolean;        // 是否使用主题
  mode?: PostingMode;        // 发帖模式
}

/**
 * 批量发帖任务响应
 */
export interface BatchPostResponse {
  success: boolean;
  taskId?: string;           // 异步任务 ID
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: {
    total: number;
    completed: number;
  };
  error?: string;
}

/**
 * 任务查询响应
 */
export interface TaskStatusResponse {
  success: boolean;
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: {
    total: number;
    completed: number;
  };
  results?: GeneratePostResponse['data'][];
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * 异步任务信息
 */
export interface AsyncTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  request: BatchPostRequest;
  results: GeneratePostResponse['data'][];
  error?: string;
  createdAt: number;
  completedAt?: number;
  progress: {
    total: number;
    completed: number;
  };
}

/**
 * 发帖成功回调请求
 */
export interface ConfirmPostRequest {
  taskId: string;            // 生成时的任务 ID
  postId?: string;           // 实际发布的帖子 ID（可选）
  success: boolean;          // 发布是否成功
}

/**
 * 发帖成功回调响应
 */
export interface ConfirmPostResponse {
  success: boolean;
  topicId?: string;          // 扣减的主题 ID
  remainingUses?: number;    // 主题剩余可用次数
  error?: string;
  code?: string;
}

/**
 * 待确认发帖记录（持久化）
 */
export interface PendingPost {
  taskId: string;            // 生成任务 ID
  topicId?: string;          // 主题 ID（如果有）
  title: string;
  content: string;
  images: ImageInfo[];
  topics?: MatchedTopic[];
  mode: PostingMode;
  createdAt: number;         // 时间戳
  subDirectionIndex?: number; // 使用的子方向索引
}
