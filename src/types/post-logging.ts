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
 * Pipeline 步骤定义
 */
export type PipelineStep = 
  | 'subDirectionSelection'      // 子方向选择
  | 'contentGeneration'          // 内容生成
  | 'materialSelection'          // 素材选择
  | 'imageUpload'                // 图片上传
  | 'topicMatching'              // 话题匹配
  | 'diversityTransform'         // 多样化变换
  | 'complianceCheck'            // 合规检查
  | 'publish';                   // 发布

/**
 * Pipeline 步骤耗时记录
 */
export interface PipelineTimings {
  [step: string]: {
    startTime: number;           // 开始时间戳（毫秒）
    endTime: number;             // 结束时间戳（毫秒）
    duration: number;            // 耗时（毫秒）
    status: 'success' | 'failed'; // 执行状态
    metadata?: any;              // 中间状态元数据
  };
}

/**
 * 资源使用情况
 */
export interface ResourceUsage {
  imageCount: number;            // 图片数量
  apiCallCount: number;          // API 调用次数
  materialLocalCount: number;    // 本地素材数量
  materialInternetCount: number; // 网络素材数量
  [key: string]: any;            // 其他资源使用指标
}

/**
 * 错误严重程度
 */
export type ErrorSeverity = 'critical' | 'severe' | 'warning' | 'info';

/**
 * 错误类型
 */
export type ErrorType = 
  | 'network'                    // 网络错误
  | 'database'                   // 数据库错误
  | 'api'                        // API 错误
  | 'compliance'                 // 合规检查错误
  | 'validation'                 // 验证错误
  | 'unknown';                   // 未知错误

/**
 * 错误信息
 */
export interface ErrorInfo {
  type: ErrorType;               // 错误类型
  severity: ErrorSeverity;       // 严重程度
  message: string;               // 错误消息
  code?: string;                 // 错误代码
  stack?: string;                // 错误堆栈
}

/**
 * 重试历史记录
 */
export interface RetryRecord {
  attempt: number;               // 尝试次数
  timestamp: number;             // 重试时间戳
  reason: string;                // 重试原因
  success: boolean;              // 是否成功
  error?: string;                // 错误信息（如失败）
  duration?: number;             // 重试耗时（毫秒）
}

/**
 * 上下文快照
 */
export interface ContextSnapshot {
  pipelineStep?: string;         // 当前 Pipeline 步骤
  taskId?: string;               // 任务 ID
  topicId?: string;              // 主题 ID
  mode: PostingMode;             // 发帖模式
  triggerType: TriggerType;      // 触发方式
  postType: PostType;            // 发帖类型
  title?: string;                // 帖子标题
  imageCount?: number;           // 图片数量
  configSnapshot?: any;          // 配置快照
  [key: string]: any;            // 其他上下文信息
}

/**
 * 发帖日志记录（扩展版）
 */
export interface PostLog {
  id: string;                    // 日志 ID（UUID）
  timestamp: number;             // 发帖时间戳
  triggerType: TriggerType;      // 触发方式：auto=自动，manual=手动
  postType: PostType;            // 发帖类型：topic=主题发帖，free=自由发帖
  mode: PostingMode;             // 发帖模式：normal=普通，featured=精华
  topicId?: string;              // 主题 ID（仅为主题发帖）
  topicName?: string;            // 主题名称（如为主题发帖）
  title: string;                 // 帖子标题
  content: string;               // 帖子内容
  imageUrls: string[];           // 图片 URL 列表
  status: 'success' | 'failed' | 'pending';  // 发帖状态（pending=等待回调）
  errorMessage?: string;         // 错误信息（如失败）
  taskId?: string;               // 任务 ID
  createdAt: number;             // 记录创建时间
  
  // === 新增：性能指标字段 ===
  pipelineTimings?: PipelineTimings;  // Pipeline 各步骤耗时
  totalDuration?: number;             // 总执行时长（毫秒）
  resourceUsage?: ResourceUsage;      // 资源使用情况
  
  // === 新增：调试信息字段 ===
  errorStack?: string;                // 错误堆栈信息
  contextSnapshot?: ContextSnapshot;  // 错误发生时的上下文快照
  retryHistory?: RetryRecord[];       // 重试历史记录
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
