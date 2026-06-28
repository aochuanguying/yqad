/**
 * 互联网搜索平台基础接口
 * 所有平台搜索服务都必须实现此接口
 */

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 标题 */
  title: string;
  /** 内容 */
  content: string;
  /** 来源平台 */
  source: string;
  /** 图片 URL 列表 */
  imageUrls?: string[];
  /** 原文链接 */
  url?: string;
  /** 作者 */
  author?: string;
  /** 点赞数 */
  likes?: number;
  /** 评论数 */
  comments?: number;
  /** 发布时间 */
  publishTime?: string;
  /** 额外数据 */
  extra?: any;
}

/**
 * 搜索平台接口
 */
export interface ISearchPlatform {
  /**
   * 搜索关键词
   * @param keywords 关键词列表
   * @param maxResults 最大结果数
   * @returns 搜索结果列表
   */
  search(keywords: string[], maxResults: number): Promise<SearchResult[]>;
  
  /**
   * 获取平台名称
   * @returns 平台标识
   */
  getPlatformName(): string;
  
  /**
   * 获取平台显示名称
   * @returns 平台中文名称
   */
  getPlatformDisplayName(): string;
  
  /**
   * 检查平台是否可用
   * @returns 是否可用
   */
  isAvailable?(): Promise<boolean>;
}

/**
 * 平台配置
 */
export interface PlatformConfig {
  /** 平台标识 */
  name: string;
  /** 平台显示名称 */
  displayName: string;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级 */
  priority: number;
  /** 权重 */
  weight: number;
  /** 频率限制（次/小时） */
  rateLimitPerHour: number;
  /** API 端点（如果有） */
  apiEndpoint?: string;
  /** API Token（如果有） */
  apiToken?: string;
  /** 额外配置 */
  extra?: any;
}
