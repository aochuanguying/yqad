// 发帖优化功能 — 全局类型接口和数据模型

/**
 * 全局发帖人设提示配置
 * 存储于 data/global-prompt.json
 */
export interface GlobalPostPrompt {
  personalInfo: {
    carModel: string;      // 车型，最大50字符
    gender: string;        // 性别，最大50字符
    ageGroup: string;      // 年龄段，最大50字符
  };
  styleDescription: string; // 内容风格描述，最大500字符
}

/**
 * 热门话题（从APP热门话题API获取）
 */
export interface HotTopic {
  id: string;
  name: string;        // 格式: "#话题名称#"
  heatDegree: number;
}

/**
 * AI语义匹配后的关联话题
 */
export interface MatchedTopic {
  id: string;
  name: string;        // 格式: "#话题名称#"
}

/**
 * 互联网参考帖子（自由发帖模式使用）
 */
export interface ReferencePost {
  title: string;
  content: string;
  source: string;        // 来源平台
  url?: string;
  imageUrls?: string[];  // 参考帖子中的图片 URL 列表（原始图片）
  processedImageUrls?: string[];  // 去水印处理后的图片 URL 列表
}

/**
 * 发帖历史摘要（主题复用去重使用）
 */
export interface PostSummary {
  title: string;
  contentSnippet: string;    // 正文前 200 字符
  timestamp: string;
  usedSubDirectionIndex?: number;  // 使用的子方向索引（可选，向后兼容）
}

/**
 * 发帖时的附加选项（图片、话题）
 */
export interface PublishOptions {
  imageUrls?: string[];          // 已上传的CDN图片URL
  topicList?: MatchedTopic[];    // 关联话题列表
}

/**
 * 内容生成器的扩展选项
 */
export interface PostGenerationOptions {
  globalPrompt?: GlobalPostPrompt;     // 全局人设
  topicHistory?: PostSummary[];        // 同主题历史（去重参考）
  referenceTexts?: ReferencePost[];    // 互联网参考素材
  references?: any[];                  // 任务 3.6: 互联网参考素材（用于分平台提示词生成）
  mode?: PostingMode;
}

/**
 * 图片去水印服务配置
 */
export interface WatermarkRemovalConfig {
  enabled: boolean;           // 是否启用去水印功能
  timeout: number;            // 去水印请求超时 (ms)
  maxRetries: number;         // 失败重试次数
  batchSize: number;          // 批量处理数量
}

/**
 * 互联网参考服务配置
 */
export interface InternetReferenceConfig {
  enabled: boolean;
  searchKeywords: string[];   // 搜索关键词列表
  maxResults: number;         // 最大返回数量 (默认 5)
  timeout: number;            // 请求超时 (ms)
  rateLimit: number;          // 每小时最大查询次数 (默认 10)
  platform: string;           // 平台标识，如 "xiaohongshu"
  watermarkRemoval?: WatermarkRemovalConfig;  // 去水印配置（可选）
}

export type PostingMode = 'featured' | 'normal';

export interface FeaturedPostingMetrics {
  contentChars: number;
  imageUrls: number;
  titleChars?: number;
  titleHasKeywords?: boolean;
  titleStyle?: string;
  hasOpening?: boolean;
  hasStructure?: boolean;
  hasEnding?: boolean;
  imageQuality?: string;
}

export interface FeaturedPostingReadiness {
  eligible: boolean;
  reasons: string[];
  metrics: FeaturedPostingMetrics;
}
