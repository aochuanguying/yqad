/**
 * MCP 搜索适配器
 * 通过 social-search MCP 服务实现 ISearchPlatform 接口
 * 
 * 各平台调用策略：
 * - 小红书: xiaohongshu_search → xiaohongshu_get_note (补正文+图片)
 * - 知乎: zhihu_search → zhihu_get_content (补图片)
 * - 汽车之家: autohome_search (已含正文+图片，无需补详情)
 */

import { ISearchPlatform, SearchResult } from './platform-base';
import { mcpSearchClient } from './mcp-search-client';
import { getLogger } from '../../utils/logger';

const logger = getLogger('mcp-search-adapter');

/** MCP 搜索结果（social-search 返回格式） */
interface McpSearchResult {
  title: string;
  snippet: string;
  author: string;
  url: string;
  publishedAt?: string;
  extra?: Record<string, any>;
}

/** MCP 内容详情（social-search 返回格式） */
interface McpContentDetail {
  title: string;
  content: string;
  author: string;
  url: string;
  publishedAt?: string;
  extra?: Record<string, any>;
}

/**
 * 小红书 MCP 适配器
 */
export class McpXiaohongshuSearch implements ISearchPlatform {
  getPlatformName(): string { return 'xiaohongshu'; }
  getPlatformDisplayName(): string { return '小红书'; }

  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    const keyword = keywords[0] || '';
    logger.info(`[MCP] 小红书搜索: "${keyword}", maxResults=${maxResults}`);

    // 1. 搜索
    const searchResults = await mcpSearchClient.callTool<McpSearchResult[]>({
      name: 'xiaohongshu_search',
      arguments: { query: keyword, maxResults },
    });

    if (!searchResults || searchResults.length === 0) {
      logger.warn('[MCP] 小红书搜索结果为空');
      return [];
    }

    // 2. 补充详情（获取正文+图片）
    const enrichCount = Math.min(5, searchResults.length);
    const results: SearchResult[] = [];

    for (let i = 0; i < searchResults.length; i++) {
      const item = searchResults[i];
      const noteId = item.extra?.noteId;
      const xsecToken = item.extra?.xsecToken;

      // 前 N 条补充详情
      if (i < enrichCount && noteId) {
        try {
          const detail = await mcpSearchClient.callTool<McpContentDetail>({
            name: 'xiaohongshu_get_note',
            arguments: { noteId, xsecToken: xsecToken || '' },
          });

          results.push(this.mapDetailToSearchResult(detail, item));
          logger.info(`[MCP] 小红书笔记详情获取成功: ${noteId}`);
          continue;
        } catch (err) {
          logger.warn(`[MCP] 小红书笔记详情获取失败 (${noteId}): ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 详情获取失败或超出补充数量，使用搜索摘要
      results.push(this.mapSearchToSearchResult(item));
    }

    logger.info(`[MCP] 小红书搜索完成, 返回 ${results.length} 条`);
    return results;
  }

  private mapDetailToSearchResult(detail: McpContentDetail, searchItem: McpSearchResult): SearchResult {
    const images = detail.extra?.images || [];
    return {
      title: detail.title || searchItem.title,
      content: detail.content || '',
      source: 'xiaohongshu',
      imageUrls: images,
      url: detail.url || searchItem.url,
      author: detail.author || searchItem.author,
      likes: parseInt(detail.extra?.likeCount) || 0,
      comments: parseInt(detail.extra?.commentCount) || 0,
      collects: parseInt(detail.extra?.collectCount) || 0,
      coverImage: searchItem.extra?.coverImage || '',
      xsecToken: searchItem.extra?.xsecToken || '',
    };
  }

  private mapSearchToSearchResult(item: McpSearchResult): SearchResult {
    return {
      title: item.title || '',
      content: item.snippet || '',
      source: 'xiaohongshu',
      imageUrls: item.extra?.coverImage ? [item.extra.coverImage] : [],
      url: item.url,
      author: item.author,
      likes: parseInt(item.extra?.likeCount) || 0,
      comments: parseInt(item.extra?.commentCount) || 0,
      collects: parseInt(item.extra?.collectCount) || 0,
      coverImage: item.extra?.coverImage || '',
      xsecToken: item.extra?.xsecToken || '',
    };
  }
}

/**
 * 知乎 MCP 适配器
 */
export class McpZhihuSearch implements ISearchPlatform {
  getPlatformName(): string { return 'zhihu'; }
  getPlatformDisplayName(): string { return '知乎'; }

  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    const keyword = keywords[0] || '';
    logger.info(`[MCP] 知乎搜索: "${keyword}", maxResults=${maxResults}`);

    // 1. 搜索（有正文但无图片）
    const searchResults = await mcpSearchClient.callTool<McpSearchResult[]>({
      name: 'zhihu_search',
      arguments: { query: keyword, maxResults },
    });

    if (!searchResults || searchResults.length === 0) {
      logger.warn('[MCP] 知乎搜索结果为空');
      return [];
    }

    // 2. 补充详情（获取图片）
    const enrichCount = Math.min(5, searchResults.length);
    const results: SearchResult[] = [];

    for (let i = 0; i < searchResults.length; i++) {
      const item = searchResults[i];

      // 前 N 条补充详情获取图片
      if (i < enrichCount && item.url) {
        try {
          // 去掉 utm 参数
          const cleanUrl = item.url.split('?')[0];
          const detail = await mcpSearchClient.callTool<McpContentDetail>({
            name: 'zhihu_get_content',
            arguments: { url: cleanUrl },
          });

          results.push(this.mapDetailToSearchResult(detail, item));
          logger.info(`[MCP] 知乎内容详情获取成功: ${cleanUrl}`);
          continue;
        } catch (err) {
          logger.warn(`[MCP] 知乎内容详情获取失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 详情获取失败，使用搜索正文（无图片）
      results.push(this.mapSearchToSearchResult(item));
    }

    logger.info(`[MCP] 知乎搜索完成, 返回 ${results.length} 条`);
    return results;
  }

  private mapDetailToSearchResult(detail: McpContentDetail, searchItem: McpSearchResult): SearchResult {
    const images = detail.extra?.images || [];
    return {
      title: detail.title || searchItem.title,
      content: detail.content || searchItem.snippet || '',
      source: 'zhihu',
      imageUrls: images,
      url: detail.url || searchItem.url,
      author: detail.author || searchItem.author,
      likes: detail.extra?.voteCount || parseInt(searchItem.extra?.voteCount) || 0,
      comments: detail.extra?.commentCount || parseInt(searchItem.extra?.commentCount) || 0,
    };
  }

  private mapSearchToSearchResult(item: McpSearchResult): SearchResult {
    return {
      title: item.title || '',
      content: item.snippet || '',
      source: 'zhihu',
      imageUrls: [],
      url: item.url,
      author: item.author,
      likes: parseInt(item.extra?.voteCount) || 0,
      comments: parseInt(item.extra?.commentCount) || 0,
    };
  }
}

/**
 * 汽车之家 MCP 适配器
 */
export class McpAutohomeSearch implements ISearchPlatform {
  getPlatformName(): string { return 'autohome'; }
  getPlatformDisplayName(): string { return '汽车之家'; }

  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    const keyword = keywords[0] || '';
    logger.info(`[MCP] 汽车之家搜索: "${keyword}", maxResults=${maxResults}`);

    // 汽车之家搜索已含正文和图片，无需补详情
    const searchResults = await mcpSearchClient.callTool<McpSearchResult[]>({
      name: 'autohome_search',
      arguments: { query: keyword, maxResults },
    });

    if (!searchResults || searchResults.length === 0) {
      logger.warn('[MCP] 汽车之家搜索结果为空');
      return [];
    }

    const results = searchResults.map(item => this.mapToSearchResult(item));
    logger.info(`[MCP] 汽车之家搜索完成, 返回 ${results.length} 条`);
    return results;
  }

  private mapToSearchResult(item: McpSearchResult): SearchResult {
    const images = item.extra?.images || [];
    return {
      title: item.title || '',
      content: item.extra?.content || item.snippet || '',
      source: 'autohome',
      imageUrls: images,
      url: item.url,
      author: item.author || '',
      likes: 0,
      comments: item.extra?.replies || 0,
      publishTime: item.publishedAt || '',
    };
  }
}
