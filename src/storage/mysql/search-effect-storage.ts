/**
 * 搜索效果 MySQL 存储
 * 
 * 功能：
 * 1. 记录每次搜索的详细信息
 * 2. 统计搜索词效果
 * 3. 分析平台搜索质量
 */

import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('search-effect-storage');

/**
 * 搜索效果记录
 */
export interface SearchEffectRecord {
  id: string;
  platform: string;
  keyword: string;
  result_count: number;
  success: boolean;
  search_time: Date;
  duration_ms?: number;
  quality_score?: number;
}

/**
 * 搜索词统计
 */
export interface KeywordStats {
  keyword: string;
  usageCount: number;
  successRate: number;
  avgResultCount: number;
}

/**
 * 搜索效果存储类
 */
class SearchEffectStorage extends BaseDAO {
  /**
   * 记录搜索效果
   */
  async recordSearchEffect(input: {
    platform: string;
    keyword: string;
    resultCount: number;
    success: boolean;
    durationMs?: number;
    qualityScore?: number;
  }): Promise<void> {
    try {
      const sql = `
        INSERT INTO search_effects (
          platform, keyword, result_count, success, duration_ms, quality_score
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      await this.insert(sql, [
        input.platform,
        input.keyword,
        input.resultCount,
        input.success ? 1 : 0,
        input.durationMs || null,
        input.qualityScore || null,
      ]);
      
      logger.debug(`搜索效果记录成功：${input.platform}, ${input.keyword}, ${input.resultCount}条`);
    } catch (error) {
      logger.error(`记录搜索效果失败：${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 获取搜索词的统计信息
   */
  async getKeywordStats(keyword: string, days: number = 7): Promise<KeywordStats | null> {
    try {
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const sql = `
        SELECT 
          keyword,
          COUNT(*) as usage_count,
          AVG(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100 as success_rate,
          AVG(result_count) as avg_result_count
        FROM search_effects
        WHERE keyword = ? AND search_time >= ?
        GROUP BY keyword
      `;
      
      const results = await this.queryMany<any>(sql, [keyword, sinceDate]);
      
      if (results.length === 0) {
        return null;
      }
      
      const stats = results[0];
      return {
        keyword: stats.keyword,
        usageCount: parseInt(stats.usage_count, 10),
        successRate: parseFloat(stats.success_rate),
        avgResultCount: parseFloat(stats.avg_result_count),
      };
    } catch (error) {
      logger.error(`获取搜索词统计失败：${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 获取平台的搜索词效果排名
   */
  async getPlatformKeywordRanking(platform: string, limit: number = 10): Promise<KeywordStats[]> {
    try {
      const sinceDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const sql = `
        SELECT 
          keyword,
          COUNT(*) as usage_count,
          AVG(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100 as success_rate,
          AVG(result_count) as avg_result_count
        FROM search_effects
        WHERE platform = ? AND search_time >= ?
        GROUP BY keyword
        ORDER BY usage_count DESC, success_rate DESC
        LIMIT ?
      `;
      
      const results = await this.queryMany<any>(sql, [platform, sinceDate, limit]);
      
      return results.map((stats: any) => ({
        keyword: stats.keyword,
        usageCount: parseInt(stats.usage_count, 10),
        successRate: parseFloat(stats.success_rate),
        avgResultCount: parseFloat(stats.avg_result_count),
      }));
    } catch (error) {
      logger.error(`获取平台搜索词排名失败：${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 获取所有平台的搜索统计
   */
  async getAllPlatformStats(days: number = 7): Promise<Array<{
    platform: string;
    totalSearches: number;
    successRate: number;
    avgResultCount: number;
  }>> {
    try {
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const sql = `
        SELECT 
          platform,
          COUNT(*) as total_searches,
          AVG(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100 as success_rate,
          AVG(result_count) as avg_result_count
        FROM search_effects
        WHERE search_time >= ?
        GROUP BY platform
        ORDER BY total_searches DESC
      `;
      
      const results = await this.queryMany<any>(sql, [sinceDate]);
      
      return results.map((stats: any) => ({
        platform: stats.platform,
        totalSearches: parseInt(stats.total_searches, 10),
        successRate: parseFloat(stats.success_rate),
        avgResultCount: parseFloat(stats.avg_result_count),
      }));
    } catch (error) {
      logger.error(`获取所有平台统计失败：${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 清理过期的搜索效果记录（保留最近 30 天）
   */
  async cleanupExpiredRecords(keepDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);
      
      const sql = `DELETE FROM search_effects WHERE search_time < ?`;
      const result = await this.delete(sql, [cutoffDate]);
      
      logger.info(`清理过期搜索效果记录：${result} 条（保留${keepDays}天）`);
      return result;
    } catch (error) {
      logger.error(`清理过期记录失败：${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}

// 导出单例
let instance: SearchEffectStorage | null = null;
export const getSearchEffectStorage = (): SearchEffectStorage => {
  if (!instance) instance = new SearchEffectStorage();
  return instance;
};
