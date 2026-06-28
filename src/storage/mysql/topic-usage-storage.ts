/**
 * 主题使用记录 MySQL 存储
 * 用于存储子方向使用记录和素材使用记录
 */

import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('topic-usage-storage');

/**
 * 子方向使用记录
 */
export interface SubDirectionUsageRecord {
  id: string;
  topic_id: string;
  sub_direction_index: number;
  used_count: number;
  last_used_date?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * 素材使用记录
 */
export interface MaterialUsageRecord {
  id: string;
  topic_id: string;
  material_path: string;
  used_count: number;
  last_used_date?: Date;
  used_in_posts?: string;  // JSON 数组存储帖子 ID 列表
  created_at: Date;
  updated_at: Date;
}

/**
 * 子方向使用输入
 */
export interface SubDirectionUsageInput {
  topicId: string;
  subDirectionIndex: number;
  usedCount?: number;
  lastUsedDate?: Date;
}

/**
 * 素材使用输入
 */
export interface MaterialUsageInput {
  topicId: string;
  materialPath: string;
  usedCount?: number;
  lastUsedDate?: Date;
  usedInPosts?: string[];
}

/**
 * 主题使用记录存储类
 */
export class TopicUsageStorage extends BaseDAO {
  /**
   * 初始化表结构
   */
  async initialize(): Promise<void> {
    try {
      // 先删除旧表（解决外键约束问题）
      await this.query('DROP TABLE IF EXISTS topic_sub_direction_usages');
      await this.query('DROP TABLE IF EXISTS topic_material_usages');
      
      // 创建子方向使用记录表（不强制外键约束，避免 topics 表不存在时失败）
      await this.query(`
        CREATE TABLE topic_sub_direction_usages (
          id VARCHAR(36) PRIMARY KEY,
          topic_id VARCHAR(36) NOT NULL,
          sub_direction_index INT NOT NULL,
          used_count INT DEFAULT 0,
          last_used_date DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_topic_sub_direction (topic_id, sub_direction_index),
          KEY idx_topic_id (topic_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      logger.info('子方向使用记录表初始化完成');

      // 创建素材使用记录表（不强制外键约束）
      await this.query(`
        CREATE TABLE topic_material_usages (
          id VARCHAR(36) PRIMARY KEY,
          topic_id VARCHAR(36) NOT NULL,
          material_path VARCHAR(500) NOT NULL,
          used_count INT DEFAULT 0,
          last_used_date DATETIME NULL,
          used_in_posts JSON NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_topic_material (topic_id, material_path),
          KEY idx_topic_id (topic_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      logger.info('素材使用记录表初始化完成');
    } catch (error: any) {
      logger.error(`初始化表结构失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 更新子方向使用记录
   */
  async upsertSubDirectionUsage(input: SubDirectionUsageInput): Promise<void> {
    const id = this.generateId();
    const sql = `
      INSERT INTO topic_sub_direction_usages 
        (id, topic_id, sub_direction_index, used_count, last_used_date)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        used_count = VALUES(used_count),
        last_used_date = VALUES(last_used_date),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await this.insert(sql, [
      id,
      input.topicId,
      input.subDirectionIndex,
      input.usedCount || 1,
      input.lastUsedDate || new Date(),
    ]);
    
    logger.debug(`已更新子方向使用记录：topic=${input.topicId}, index=${input.subDirectionIndex}`);
  }

  /**
   * 获取子方向使用记录
   */
  async getSubDirectionUsages(topicId: string): Promise<SubDirectionUsageRecord[]> {
    const sql = `
      SELECT * FROM topic_sub_direction_usages 
      WHERE topic_id = ? 
      ORDER BY sub_direction_index
    `;
    return await this.queryMany<SubDirectionUsageRecord>(sql, [topicId]);
  }

  /**
   * 获取子方向使用统计
   */
  async getSubDirectionStats(topicId: string): Promise<Array<{
    index: number;
    usedCount: number;
    lastUsedDate?: Date;
  }>> {
    const usages = await this.getSubDirectionUsages(topicId);
    return usages.map(u => ({
      index: u.sub_direction_index,
      usedCount: u.used_count,
      lastUsedDate: u.last_used_date || undefined,
    }));
  }

  /**
   * 更新素材使用记录
   */
  async upsertMaterialUsage(input: MaterialUsageInput): Promise<void> {
    const id = this.generateId();
    const usedInPostsJson = input.usedInPosts ? JSON.stringify(input.usedInPosts) : null;
    
    const sql = `
      INSERT INTO topic_material_usages 
        (id, topic_id, material_path, used_count, last_used_date, used_in_posts)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        used_count = VALUES(used_count),
        last_used_date = VALUES(last_used_date),
        used_in_posts = VALUES(used_in_posts),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await this.insert(sql, [
      id,
      input.topicId,
      input.materialPath,
      input.usedCount || 1,
      input.lastUsedDate || new Date(),
      usedInPostsJson,
    ]);
    
    logger.debug(`已更新素材使用记录：topic=${input.topicId}, path=${input.materialPath}`);
  }

  /**
   * 获取素材使用记录
   */
  async getMaterialUsages(topicId: string): Promise<MaterialUsageRecord[]> {
    const sql = `
      SELECT * FROM topic_material_usages 
      WHERE topic_id = ? 
      ORDER BY used_count ASC
    `;
    return await this.queryMany<MaterialUsageRecord>(sql, [topicId]);
  }

  /**
   * 获取素材使用统计
   */
  async getMaterialStats(topicId: string): Promise<Array<{
    path: string;
    usedCount: number;
    lastUsedDate?: Date;
    usedInPosts: string[];
  }>> {
    const usages = await this.getMaterialUsages(topicId);
    return usages.map(u => ({
      path: u.material_path,
      usedCount: u.used_count,
      lastUsedDate: u.last_used_date || undefined,
      usedInPosts: u.used_in_posts ? JSON.parse(u.used_in_posts) : [],
    }));
  }

  /**
   * 删除主题的所有使用记录
   */
  async deleteByTopicId(topicId: string): Promise<void> {
    await this.query('DELETE FROM topic_sub_direction_usages WHERE topic_id = ?', [topicId]);
    await this.query('DELETE FROM topic_material_usages WHERE topic_id = ?', [topicId]);
    logger.debug(`已删除主题 ${topicId} 的所有使用记录`);
  }

  private generateId(): string {
    return require('uuid').v4();
  }
}

let instance: TopicUsageStorage | null = null;
export const getTopicUsageStorage = (): TopicUsageStorage => {
  if (!instance) {
    instance = new TopicUsageStorage();
  }
  return instance;
};
export const topicUsageStorage = getTopicUsageStorage();
