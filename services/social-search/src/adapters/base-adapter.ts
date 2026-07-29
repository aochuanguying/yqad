export interface SearchResult {
  title: string;
  snippet: string;
  author: string;
  url: string;
  publishedAt?: string;
  extra?: Record<string, any>;
}

export interface ContentDetail {
  title: string;
  content: string;
  author: string;
  url: string;
  publishedAt?: string;
  extra?: Record<string, any>;
}

export interface SearchOptions {
  query: string;
  type?: string;
  sortBy?: string;
  maxResults?: number;
  summaryMode?: boolean;
  noCache?: boolean;
}

export interface AdapterError {
  error: string;
  message: string;
}

/**
 * 搜索适配器抽象基类
 */
export abstract class BaseAdapter {
  abstract readonly platform: string;

  /**
   * 搜索内容
   */
  abstract search(options: SearchOptions): Promise<SearchResult[]>;

  /**
   * 获取内容详情
   */
  abstract getContent(params: Record<string, string>): Promise<ContentDetail | AdapterError>;

  /**
   * 截断摘要
   */
  protected truncateSnippet(text: string, summaryMode: boolean): string {
    const maxLen = summaryMode ? 100 : 500;
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '...';
  }
}
