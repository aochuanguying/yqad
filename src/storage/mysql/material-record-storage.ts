/**
 * 素材记录 MySQL 存储（带 ChromaDB 同步）
 */

import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';
import { materialVectorStorage } from '../chroma/material-vector-storage';
import { embeddingVectorizer } from '../../utils/embedding-vectorizer';
import { getLogger } from '../../utils/logger';

const logger = getLogger('material-record-storage');

export interface MaterialRecord {
  id: string;
  source: 'local' | 'internet';
  path: string;
  url?: string;
  quality_score?: any;
  matched_keywords?: any;
  usage_count: number;
  last_used_date?: Date;
  associated_posts?: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateMaterialRecordInput {
  id?: string;
  source: 'local' | 'internet';
  path: string;
  url?: string;
  qualityScore?: any;
  matchedKeywords?: any;
  usageCount?: number;
  associatedPosts?: any;
}

export class MaterialRecordStorage extends BaseDAO {
  /**
   * 创建或更新素材记录（带 ChromaDB 同步）
   */
  async upsertMaterialRecord(input: CreateMaterialRecordInput): Promise<MaterialRecord> {
    return await this.executeInTransaction<MaterialRecord>(async (conn) => {
      const id = input.id || uuidv4();
      
      const sql = `
        INSERT INTO material_records (
          id, source, path, url, quality_score, matched_keywords, usage_count, associated_posts
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          source = VALUES(source),
          path = VALUES(path),
          url = VALUES(url),
          quality_score = VALUES(quality_score),
          matched_keywords = VALUES(matched_keywords),
          usage_count = VALUES(usage_count),
          last_used_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      // 确保是数组
      let matchedKeywordsArray: any = input.matchedKeywords;
      if (matchedKeywordsArray && !Array.isArray(matchedKeywordsArray)) {
        // 如果是字符串，按逗号分割
        if (typeof matchedKeywordsArray === 'string') {
          matchedKeywordsArray = matchedKeywordsArray.split(/[,，]/).map((t: string) => t.trim()).filter((t: string) => t.length > 0);
          logger.warn(`matchedKeywords 是字符串，已转换为数组`);
        } else {
          matchedKeywordsArray = [matchedKeywordsArray];
        }
      }
      
      let associatedPostsArray = input.associatedPosts;
      if (associatedPostsArray && !Array.isArray(associatedPostsArray)) {
        if (typeof associatedPostsArray === 'string') {
          associatedPostsArray = associatedPostsArray.split(/[,，]/).map((t: string) => t.trim()).filter((t: string) => t.length > 0);
        } else {
          associatedPostsArray = [associatedPostsArray];
        }
        logger.warn(`associatedPosts 不是数组，已转换：${JSON.stringify(associatedPostsArray)}`);
      }
      
      await conn.execute(sql, [
        id,
        input.source,
        input.path,
        input.url || null,
        input.qualityScore ? JSON.stringify(input.qualityScore) : null,
        matchedKeywordsArray ? JSON.stringify(matchedKeywordsArray) : null,
        input.usageCount || 0,
        associatedPostsArray ? JSON.stringify(associatedPostsArray) : null,
      ]);
      
      const record = await this.getMaterialRecordByIdWithConnection(conn, id);
      if (!record) {
        throw new Error('创建素材记录失败');
      }
      
      // 同步到 ChromaDB
      await this.syncToChromaDB(conn, record);
      
      logger.debug(`素材记录已同步到 ChromaDB：${id}`);
      
      return record;
    });
  }

  /**
   * 同步素材到 ChromaDB
   */
  private async syncToChromaDB(conn: any, record: MaterialRecord): Promise<void> {
    try {
      // 检查 ChromaDB 是否已初始化，如果未初始化则尝试初始化
      if (!materialVectorStorage.isInitialized) {
        try {
          await materialVectorStorage.initialize();
          logger.info('MaterialVectorStorage 延迟初始化成功');
        } catch (initError) {
          logger.debug('MaterialVectorStorage 初始化失败，跳过同步:', initError instanceof Error ? initError.message : String(initError));
          return;
        }
      }
      
      // 构建向量文本
      const vectorText = this.buildVectorText(record);
      if (!vectorText.trim()) {
        logger.debug('向量文本为空，跳过同步');
        return;
      }
      
      // 生成向量
      const embedding = await embeddingVectorizer.generateEmbedding(vectorText);
      
      // 检查是否已存在
      const existingId = await materialVectorStorage.findByFilePath(record.path);
      
      if (existingId) {
        // 更新现有向量
        await materialVectorStorage.updateVector(
          existingId,
          embedding,
          {
            file_path: record.path,
            file_name: record.path.split('/').pop() || '',
          }
        );
        logger.debug(`更新 ChromaDB 向量：${existingId}`);
      } else {
        // 添加新向量
        await materialVectorStorage.addVector(
          `material_${record.id}`,
          embedding,
          {
            file_path: record.path,
            file_name: record.path.split('/').pop() || '',
          }
        );
        logger.debug(`添加 ChromaDB 向量：material_${record.id}`);
      }
    } catch (error) {
      logger.error('同步 ChromaDB 失败:', error);
      // 不抛出异常，避免影响主流程
    }
  }

  /**
   * 构建向量文本
   */
  private buildVectorText(record: MaterialRecord): string {
    return record.path.split('/').pop() || '';
  }

  /**
   * 使用已有连接获取记录（辅助方法）
   */
  private async getMaterialRecordByIdWithConnection(conn: any, id: string): Promise<MaterialRecord | null> {
    const sql = 'SELECT * FROM material_records WHERE id = ?';
    const [rows] = await conn.query(sql, [id]);
    const result = rows as any[];
    return result.length > 0 ? this.mapToMaterialRecord(result[0]) : null;
  }

  /**
   * 映射数据库记录到接口
   */
  private mapToMaterialRecord(row: any): MaterialRecord {
    let qualityScore = null;
    let matchedKeywords = null;
    let associatedPosts = null;
    
    // 安全解析 JSON 字段，处理旧数据格式
    if (row.quality_score) {
      try {
        qualityScore = JSON.parse(row.quality_score);
      } catch (e) {
        logger.warn(`解析 quality_score 失败，使用原值`);
        qualityScore = row.quality_score;
      }
    }
    
    if (row.matched_keywords) {
      // MySQL JSON 类型会自动解析为数组，不需要 JSON.parse
      if (Array.isArray(row.matched_keywords)) {
        matchedKeywords = row.matched_keywords;
      } else {
        try {
          matchedKeywords = JSON.parse(row.matched_keywords);
          // 确保是数组
          if (!Array.isArray(matchedKeywords)) {
            matchedKeywords = [matchedKeywords];
          }
        } catch (e) {
          // 可能是旧格式的逗号分隔字符串
          if (typeof row.matched_keywords === 'string') {
            matchedKeywords = row.matched_keywords.split(/[,,]/)
              .map((t: string) => t.trim())
              .filter((t: string) => t.length > 0);
          } else {
            matchedKeywords = [row.matched_keywords];
          }
          logger.warn(`matched_keywords JSON 解析失败，使用逗号分隔解析：${matchedKeywords.join(',')}`);
        }
      }
    }
    
    if (row.associated_posts) {
      // MySQL JSON 类型会自动解析为数组，不需要 JSON.parse
      if (Array.isArray(row.associated_posts)) {
        associatedPosts = row.associated_posts;
      } else {
        try {
          associatedPosts = JSON.parse(row.associated_posts);
        } catch (e) {
          logger.warn(`解析 associated_posts 失败，使用原值`);
          associatedPosts = row.associated_posts;
        }
      }
    }
    
    return {
      id: row.id,
      source: row.source,
      path: row.path,
      url: row.url,
      quality_score: qualityScore,
      matched_keywords: matchedKeywords,
      usage_count: row.usage_count,
      last_used_date: row.last_used_date,
      associated_posts: associatedPosts,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * 获取素材记录
   */
  async getMaterialRecordById(id: string): Promise<MaterialRecord | null> {
    const sql = `SELECT * FROM material_records WHERE id = ?`;
    return await this.queryOne<MaterialRecord>(sql, [id]);
  }

  /**
   * 查询素材记录列表
   */
  async queryMaterialRecords(options?: {
    page?: number;
    pageSize?: number;
    source?: string;
    usedCount?: number;
  }): Promise<{
    data: MaterialRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    let sql = `SELECT * FROM material_records WHERE 1=1`;
    const params: any[] = [];

    if (options?.source) {
      sql += ` AND source = ?`;
      params.push(options.source);
    }
    if (options?.usedCount !== undefined) {
      sql += ` AND usage_count >= ?`;
      params.push(options.usedCount);
    }

    sql += ` ORDER BY usage_count ASC, created_at DESC`;

    return await this.queryPaginated<MaterialRecord>(sql, params, options?.page || 1, options?.pageSize || 50);
  }

  /**
   * 获取所有素材记录
   */
  async getAllMaterialRecords(): Promise<MaterialRecord[]> {
    const sql = `SELECT * FROM material_records ORDER BY usage_count ASC, created_at DESC`;
    return await this.queryMany<MaterialRecord>(sql, []);
  }

  /**
   * 获取指定时间后更新的素材
   */
  async getMaterialsUpdatedAfter(after: Date): Promise<MaterialRecord[]> {
    const sql = `SELECT * FROM material_records WHERE updated_at > ? ORDER BY updated_at DESC`;
    return await this.queryMany<MaterialRecord>(sql, [after]);
  }

  /**
   * 更新使用次数
   */
  async incrementUsedCount(id: string): Promise<void> {
    const sql = `UPDATE material_records SET usage_count = usage_count + 1, last_used_date = CURRENT_TIMESTAMP WHERE id = ?`;
    await this.update(sql, [id]);
  }

  /**
   * 删除素材记录（同步删除 ChromaDB 向量）
   */
  async deleteMaterialRecord(id: string): Promise<number> {
    const sql = `DELETE FROM material_records WHERE id = ?`;
    
    try {
      // 1. 从 MySQL 删除
      const deleted = await this.delete(sql, [id]);
      
      if (deleted > 0) {
        // 2. 同步删除 ChromaDB 向量
        try {
          await materialVectorStorage.deleteVector(id);
          logger.info(`删除素材记录及 ChromaDB 向量：${id}`);
        } catch (chromaError) {
          logger.warn(`删除 ChromaDB 向量失败：${id}, 但 MySQL 删除成功`, chromaError);
          // 不抛出错误，避免 MySQL 删除失败
        }
      }
      
      return deleted;
    } catch (error) {
      logger.error(`删除素材记录失败：${id}`, error);
      throw error;
    }
  }

  /**
   * 根据路径删除素材记录（同步删除 ChromaDB 向量）
   * 用于清理已删除的 processed 文件对应的记录
   */
  async deleteMaterialRecordByPath(filePath: string): Promise<number> {
    const sql = `DELETE FROM material_records WHERE path = ?`;
    
    try {
      // 1. 从 MySQL 删除
      const [rows] = await this.query(sql, [filePath]);
      const deleted = rows?.affectedRows || 0;
      
      if (deleted > 0) {
        // 2. 同步删除 ChromaDB 向量（通过 file_path 查找）
        try {
          const existingId = await materialVectorStorage.findByFilePath(filePath);
          if (existingId) {
            await materialVectorStorage.deleteVector(existingId);
            logger.info(`删除素材记录及 ChromaDB 向量：${filePath} (id: ${existingId})`);
          }
        } catch (chromaError) {
          logger.warn(`删除 ChromaDB 向量失败：${filePath}, 但 MySQL 删除成功`, chromaError);
          // 不抛出错误，避免 MySQL 删除失败
        }
      }
      
      return deleted;
    } catch (error) {
      logger.error(`删除素材记录失败：${filePath}`, error);
      throw error;
    }
  }
}

let instance: MaterialRecordStorage | null = null;
export const getMaterialRecordStorage = (): MaterialRecordStorage => {
  if (!instance) instance = new MaterialRecordStorage();
  return instance;
};
