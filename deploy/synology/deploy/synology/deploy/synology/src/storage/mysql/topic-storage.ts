/**
 * 主题 MySQL 存储
 */

import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';

export interface Topic {
  id: string;
  name: string;
  max_use_count: number;
  current_use_count: number;
  status: 'available' | 'unavailable';
  tags?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TopicSubDirection {
  id: string;
  topic_id: string;
  name: string;
  created_at: Date;
}

export interface CreateTopicInput {
  id?: string;
  name: string;
  maxUseCount?: number;
  currentUseCount?: number;
  status?: 'available' | 'unavailable';
  tags?: string[];
  subDirections?: Array<{ id: string; name: string }>;
}

export class TopicStorage extends BaseDAO {
  /**
   * 创建或更新主题
   */
  async upsertTopic(input: CreateTopicInput): Promise<Topic> {
    const id = input.id || uuidv4();
    const tags = input.tags ? JSON.stringify(input.tags) : null;
    
    const sql = `
      INSERT INTO topics (id, name, max_use_count, current_use_count, status, tags)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        max_use_count = VALUES(max_use_count),
        current_use_count = VALUES(current_use_count),
        status = VALUES(status),
        tags = VALUES(tags),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await this.insert(sql, [
      id,
      input.name,
      input.maxUseCount || 1,
      input.currentUseCount || 0,
      input.status || 'available',
      tags,
    ]);
    
    const topic = await this.getTopicById(id);
    if (!topic) throw new Error('创建主题失败');
    return topic;
  }

  /**
   * 获取主题
   */
  async getTopicById(id: string): Promise<Topic | null> {
    const sql = `SELECT * FROM topics WHERE id = ?`;
    return await this.queryOne<Topic>(sql, [id]);
  }

  /**
   * 获取所有主题
   */
  async getAllTopics(): Promise<Topic[]> {
    const sql = `SELECT * FROM topics ORDER BY created_at DESC`;
    return await this.queryMany<Topic>(sql, []);
  }

  /**
   * 获取主题列表（分页）
   */
  async getTopics(options?: {
    page?: number;
    pageSize?: number;
    status?: string;
  }): Promise<{
    data: Topic[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    let sql = `SELECT * FROM topics WHERE 1=1`;
    const params: any[] = [];

    if (options?.status) {
      sql += ` AND status = ?`;
      params.push(options.status);
    }

    sql += ` ORDER BY created_at DESC`;

    return await this.queryPaginated<Topic>(sql, params, options?.page || 1, options?.pageSize || 20);
  }

  /**
   * 更新主题使用次数
   */
  async updateTopicUseCount(id: string, count: number): Promise<boolean> {
    const sql = `UPDATE topics SET current_use_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const affected = await this.update(sql, [count, id]);
    return affected > 0;
  }

  /**
   * 重置主题使用次数
   */
  async resetTopicUseCount(id: string): Promise<boolean> {
    return await this.updateTopicUseCount(id, 0);
  }

  /**
   * 重置所有主题
   */
  async resetAllTopics(): Promise<number> {
    const sql = `UPDATE topics SET current_use_count = 0, status = 'available'`;
    return await this.update(sql, []);
  }

  /**
   * 删除主题
   */
  async deleteTopic(id: string): Promise<number> {
    const sql = `DELETE FROM topics WHERE id = ?`;
    return await this.delete(sql, [id]);
  }

  /**
   * 添加子方向
   */
  async addSubDirection(topicId: string, subDirection: { id: string; name: string }): Promise<void> {
    const sql = `INSERT INTO topic_sub_directions (id, topic_id, name) VALUES (?, ?, ?)`;
    await this.insert(sql, [subDirection.id, topicId, subDirection.name]);
  }

  /**
   * 获取子方向
   */
  async getSubDirections(topicId: string): Promise<TopicSubDirection[]> {
    const sql = `SELECT * FROM topic_sub_directions WHERE topic_id = ?`;
    return await this.queryMany<TopicSubDirection>(sql, [topicId]);
  }

  /**
   * 删除子方向
   */
  async deleteSubDirection(id: string): Promise<number> {
    const sql = `DELETE FROM topic_sub_directions WHERE id = ?`;
    return await this.delete(sql, [id]);
  }
}

let instance: TopicStorage | null = null;
export const getTopicStorage = (): TopicStorage => {
  if (!instance) instance = new TopicStorage();
  return instance;
};
