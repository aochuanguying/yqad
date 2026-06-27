/**
 * 发帖间隔控制服务
 * 
 * 功能：
 * 1. 检查主题发帖间隔
 * 2. 白名单管理
 * 3. 紧急发帖豁免
 */

import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { getTopicStorage } from '../storage/mysql/topic-storage';

const logger = getLogger('posting-interval-control');
const topicStorage = getTopicStorage();

/**
 * 发帖间隔检查结果
 */
export interface PostingIntervalCheckResult {
  allowed: boolean;
  topicId: string;
  topicName?: string;
  lastPostDate?: string;
  daysSinceLastPost?: number;
  minIntervalDays: number;
  reason?: string;
  canOverride?: boolean;
}

/**
 * 发帖间隔控制服务类
 */
class PostingIntervalControlService {
  /**
   * 检查主题发帖间隔
   */
  async checkPostingInterval(topicId: string, topicName?: string): Promise<PostingIntervalCheckResult> {
    const config = loadConfig();
    const minIntervalDays = config.postingIntervalControl?.minIntervalDays || 5;
    const whitelist = config.postingIntervalControl?.whitelist || [];
    const enableEmergencyOverride = config.postingIntervalControl?.enableEmergencyOverride || false;

    // 检查白名单
    if (whitelist.includes(topicId)) {
      logger.debug(`主题 "${topicName || topicId}" 在白名单中，跳过间隔检查`);
      return {
        allowed: true,
        topicId,
        topicName,
        minIntervalDays,
        reason: '白名单主题',
        canOverride: false,
      };
    }

    try {
      // 从 MySQL 读取主题数据
      const topic = await topicStorage.getTopicById(topicId);

      if (!topic) {
        logger.debug(`主题 "${topicId}" 不存在，允许发帖`);
        return {
          allowed: true,
          topicId,
          topicName,
          minIntervalDays,
          reason: '主题不存在',
          canOverride: enableEmergencyOverride,
        };
      }

      // 检查最后发帖时间（从 tags 字段解析）
      const tags = topic.tags ? JSON.parse(topic.tags) : {};
      const lastPostDate = tags.lastPostDate ? new Date(tags.lastPostDate) : null;

      if (!lastPostDate) {
        logger.debug(`主题 "${topicName || topicId}" 首次发帖，允许`);
        return {
          allowed: true,
          topicId,
          topicName,
          minIntervalDays,
          reason: '首次发帖',
          canOverride: enableEmergencyOverride,
        };
      }

      const now = new Date();
      const daysSinceLastPost = Math.floor((now.getTime() - lastPostDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceLastPost >= minIntervalDays) {
        logger.info(`主题 "${topicName || topicId}" 距上次发帖 ${daysSinceLastPost} 天，满足间隔要求`);
        return {
          allowed: true,
          topicId,
          topicName,
          lastPostDate: tags.lastPostDate,
          daysSinceLastPost,
          minIntervalDays,
          reason: '满足间隔要求',
          canOverride: enableEmergencyOverride,
        };
      } else {
        logger.warn(`主题 "${topicName || topicId}" 距上次发帖仅 ${daysSinceLastPost} 天，不满足 ${minIntervalDays} 天间隔要求`);
        return {
          allowed: false,
          topicId,
          topicName,
          lastPostDate: tags.lastPostDate,
          daysSinceLastPost,
          minIntervalDays,
          reason: `距上次发帖仅${daysSinceLastPost}天，需等待${minIntervalDays - daysSinceLastPost}天`,
          canOverride: enableEmergencyOverride,
        };
      }
    } catch (error) {
      logger.error(`读取主题数据失败：${error instanceof Error ? error.message : String(error)}`);
      return {
        allowed: true,
        topicId,
        topicName,
        minIntervalDays,
        reason: '读取主题数据失败',
        canOverride: enableEmergencyOverride,
      };
    }
  }

  /**
   * 更新主题最后发帖时间
   */
  async updateLastPostDate(topicId: string): Promise<void> {
    try {
      const topic = await topicStorage.getTopicById(topicId);
      if (!topic) {
        logger.warn(`主题 "${topicId}" 不存在，无法更新最后发帖时间`);
        return;
      }

      // 更新 tags 字段中的 lastPostDate
      const tags = topic.tags ? JSON.parse(topic.tags) : {};
      tags.lastPostDate = new Date().toISOString();
      
      await topicStorage.upsertTopic({
        id: topicId,
        name: topic.name,
        maxUseCount: topic.max_use_count,
        currentUseCount: topic.current_use_count,
        status: topic.status,
        tags: Object.keys(tags).length > 0 ? tags : undefined,
      });

      logger.debug(`已更新主题 "${topicId}" 的最后发帖时间`);
    } catch (error) {
      logger.error(`更新最后发帖时间失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查紧急发帖豁免
   */
  checkEmergencyOverride(topicId: string, topicName?: string): boolean {
    const config = loadConfig();
    const enableEmergencyOverride = config.postingIntervalControl?.enableEmergencyOverride || false;

    if (!enableEmergencyOverride) {
      logger.debug('紧急发帖豁免功能未启用');
      return false;
    }

    // 这里可以添加更复杂的权限验证逻辑
    // 目前简化为只要启用了紧急豁免就允许
    logger.info(`允许紧急发帖豁免：主题 "${topicName || topicId}"`);
    return true;
  }

  /**
   * 批量检查主题间隔状态
   */
  async batchCheckStatus(topicIds: string[]): Promise<Array<{
    topicId: string;
    allowed: boolean;
    daysUntilAllowed?: number;
  }>> {
    const results: Array<{
      topicId: string;
      allowed: boolean;
      daysUntilAllowed?: number;
    }> = [];
    
    for (const topicId of topicIds) {
      const result = await this.checkPostingInterval(topicId);
      results.push({
        topicId,
        allowed: result.allowed,
        daysUntilAllowed: result.allowed ? 0 : result.minIntervalDays - (result.daysSinceLastPost || 0),
      });
    }
    
    return results;
  }
}

// 导出单例
export const postingIntervalControlService = new PostingIntervalControlService();
