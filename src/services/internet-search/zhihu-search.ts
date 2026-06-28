/**
 * 知乎搜索服务
 * 实现方案：知乎官方数据开放平台 API
 * 
 * API 文档：https://developer.zhihu.com/
 * 特点：
 * - 官方 API，稳定可靠
 * - 每天免费 1000 次调用
 * - 高质量内容，专业领域覆盖
 * 
 * 使用方法：
 * 1. 访问 https://developer.zhihu.com/ 注册
 * 2. 创建应用获取 Access Secret
 * 3. 设置环境变量 ZHIHU_ACCESS_SECRET
 */

import { ISearchPlatform, SearchResult } from './platform-base';
import { getLogger } from '../../utils/logger';
import * as http from 'http';
import * as https from 'https';

const logger = getLogger('zhihu-search');

// 知乎 Access Secret（从知乎开放平台获取）
const ZHIHU_ACCESS_SECRET = process.env.ZHIHU_ACCESS_SECRET || '';

export class ZhihuSearch implements ISearchPlatform {
  private platformName = 'zhihu';
  private platformDisplayName = '知乎';
  
  getPlatformName(): string {
    return this.platformName;
  }
  
  getPlatformDisplayName(): string {
    return this.platformDisplayName;
  }
  
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    try {
      logger.info(`开始搜索知乎，关键词：${keywords.join(', ')}, 最大结果数：${maxResults}`);
      
      if (!ZHIHU_ACCESS_SECRET) {
        logger.warn('知乎 Access Secret 未配置，跳过搜索');
        return [];
      }
      
      // 使用知乎官方 API
      const results = await this.searchViaApi(keywords, maxResults);
      return results;
      
    } catch (error) {
      logger.error('知乎搜索失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  
  /**
   * 使用知乎官方 API 搜索
   * API 文档：https://developer.zhihu.com/
   * 
   * 请求参数：
   * - Query: 搜索关键词（必填）
   * - Count: 结果数量（选填，默认 10，最大 10）
   * 
   * 响应参数：
   * - Code: 错误码（0 表示成功）
   * - Message: 响应消息
   * - Data: 搜索数据
   *   - HasMore: 是否有更多结果
   *   - SearchHashId: 搜索请求标识
   *   - Items: 搜索结果列表
   *   - EmptyReason: 无结果原因
   */
  private async searchViaApi(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    try {
      const keyword = keywords[0];
      const url = `https://developer.zhihu.com/api/v1/content/zhihu_search`;
      
      // 当前时间戳（秒级）
      const timestamp = Math.floor(Date.now() / 1000);
      
      // 请求头
      const headers: any = {
        'Authorization': `Bearer ${ZHIHU_ACCESS_SECRET}`,
        'X-Request-Timestamp': timestamp.toString(),
        'Content-Type': 'application/json',
      };
      
      // 请求参数（Count 最大为 10）
      const count = Math.min(Math.max(maxResults, 1), 10);
      const params = new URLSearchParams({
        'Query': keyword,
        'Count': count.toString(),
      });
      
      logger.info(`请求知乎 API: ${url}?${params.toString()}`);
      
      // 发送 GET 请求
      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        logger.warn(`知乎搜索失败：HTTP ${response.status}`);
        return [];
      }
      
      const data: any = await response.json();
      
      // 检查响应码
      if (data.Code !== 0) {
        logger.warn(`知乎 API 返回错误：Code=${data.Code}, Message=${data.Message}`);
        return [];
      }
      
      // 解析搜索结果
      const searchData = data.Data || {};
      const items = searchData.Items || [];
      const emptyReason = searchData.EmptyReason || '';
      
      if (items.length === 0 && emptyReason) {
        logger.info(`知乎搜索无结果：${emptyReason}`);
      } else {
        logger.info(`搜索成功，找到 ${items.length} 条结果`);
      }
      
      // 转换为 SearchResult 格式
      return items.map((item: any) => {
        // 提取作者信息
        const authorName = item.AuthorName || '';
        const authorAvatar = item.AuthorAvatar || '';
        const authorBadge = item.AuthorBadge || '';
        const authorBadgeText = item.AuthorBadgeText || '';
        
        // 构建作者信息字符串
        let author = authorName;
        if (authorBadgeText) {
          author += ` (${authorBadgeText})`;
        }
        
        // 统计数据
        const voteUpCount = item.VoteUpCount || 0;
        const commentCount = item.CommentCount || 0;
        
        // 权威等级和排序分数
        const authorityLevel = item.AuthorityLevel || '';
        const rankingScore = item.RankingScore || 0;
        
        return {
          title: item.Title || '',
          content: item.ContentText || '',
          source: this.platformDisplayName,
          url: item.Url || '',
          author: author,
          likes: voteUpCount,
          comments: commentCount,
          // 额外信息（可选）
          metadata: {
            contentType: item.ContentType || '',
            contentId: item.ContentID || '',
            authorAvatar,
            authorBadge,
            editTime: item.EditTime || 0,
            authorityLevel,
            rankingScore,
          },
        };
      });
      
    } catch (error) {
      logger.error('调用知乎 API 失败:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://www.zhihu.com', {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}
