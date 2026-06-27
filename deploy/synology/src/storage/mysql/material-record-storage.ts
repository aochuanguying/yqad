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
  original_path: string;
  processed_path: string;
  original_hash?: string;
  processed_hash?: string;
  file_size?: number;
  width?: number;
  height?: number;
  format?: string;
  is_watermark: boolean;
  ocr_text?: string;
  description?: string;
  tags?: string;
  source_type: 'local' | 'internet';
  internet_url?: string;
  used_count: number;
  last_used_at?: Date;
  status: 'available' | 'used' | 'archived';
  created_at: Date;
  updated_at: Date;
}

export interface CreateMaterialRecordInput {
  id?: string;
  originalPath: string;
  processedPath: string;
  originalHash?: string;
  processedHash?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  isWatermark?: boolean;
  ocrText?: string;
  description?: string;
  tags?: string[];
  sourceType?: 'local' | 'internet';
  internetUrl?: string;
  usedCount?: number;
}

export class MaterialRecordStorage extends BaseDAO {
  /**
   * 创建或更新素材记录（带 ChromaDB 同步）
   */
  async upsertMaterialRecord(input: CreateMaterialRecordInput): Promise<MaterialRecord> {
    return await this.executeInTransaction<MaterialRecord>(async (conn) => {
      const id = input.id || uuidv4();
      const tags = input.tags ? JSON.stringify(input.tags) : null;
      
      const sql = `
        INSERT INTO material_records (
          id, original_path, processed_path, original_hash, processed_hash,
          file_size, width, height, format, is_watermark, ocr_text, description,
          tags, source_type, internet_url, used_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          original_path = VALUES(original_path),
          processed_path = VALUES(processed_path),
          used_count = VALUES(used_count),
          last_used_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await conn.execute(sql, [
        id,
        input.originalPath,
        input.processedPath,
        input.originalHash || null,
        input.processedHash || null,
        input.fileSize || null,
        input.width || null,
        input.height || null,
        input.format || null,
        input.isWatermark || false,
        input.ocrText || null,
        input.description || null,
        tags,
        input.sourceType || 'local',
        input.internetUrl || null,
        input.usedCount || 0,
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
      // 检查 ChromaDB 是否已初始化
      if (!materialVectorStorage.isInitialized) {
        logger.debug('ChromaDB 未初始化，跳过同步');
        return;
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
      const existingId = await materialVectorStorage.findByFilePath(record.processed_path);
      
      if (existingId) {
        // 更新现有向量
        await materialVectorStorage.updateVector(
          existingId,
          embedding,
          {
            file_path: record.processed_path,
            file_name: record.original_path.split('/').pop() || '',
            description: record.description || '',
            tags: record.tags ? record.tags.split(',').filter(t => t.trim()) : [],
          }
        );
        logger.debug(`更新 ChromaDB 向量：${existingId}`);
      } else {
        // 添加新向量
        await materialVectorStorage.addVector(
          `material_${record.id}`,
          embedding,
          {
            file_path: record.processed_path,
            file_name: record.original_path.split('/').pop() || '',
            description: record.description || '',
            tags: record.tags ? record.tags.split(',').filter(t => t.trim()) : [],
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
    const parts = [
      record.original_path.split('/').pop() || '',
      record.description || '',
      record.ocr_text || '',
      record.tags || '',
    ];
    return parts.filter(p => p.trim()).join(' ');
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
    return {
      id: row.id,
      original_path: row.original_path,
      processed_path: row.processed_path,
      original_hash: row.original_hash,
      processed_hash: row.processed_hash,
      file_size: row.file_size,
      width: row.width,
      height: row.height,
      format: row.format,
      is_watermark: row.is_watermark === 1,
      ocr_text: row.ocr_text,
      description: row.description,
      tags: row.tags,
      source_type: row.source_type,
      internet_url: row.internet_url,
      used_count: row.used_count,
      last_used_at: row.last_used_at,
      status: row.status,
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
    sourceType?: string;
    status?: string;
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

    if (options?.sourceType) {
      sql += ` AND source_type = ?`;
      params.push(options.sourceType);
    }
    if (options?.status) {
      sql += ` AND status = ?`;
      params.push(options.status);
    }
    if (options?.usedCount !== undefined) {
      sql += ` AND used_count >= ?`;
      params.push(options.usedCount);
    }

    sql += ` ORDER BY used_count ASC, created_at DESC`;

    return await this.queryPaginated<MaterialRecord>(sql, params, options?.page || 1, options?.pageSize || 50);
  }

  /**
   * 获取所有素材记录
   */
  async getAllMaterialRecords(): Promise<MaterialRecord[]> {
    const sql = `SELECT * FROM material_records ORDER BY used_count ASC, created_at DESC`;
    return await this.queryMany<MaterialRecord>(sql, []);
  }

  /**
   * 更新使用次数
   */
  async incrementUsedCount(id: string): Promise<void> {
    const sql = `UPDATE material_records SET used_count = used_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await this.update(sql, [id]);
  }

  /**
   * 更新状态
   */
  async updateStatus(id: string, status: 'available' | 'used' | 'archived'): Promise<void> {
    const sql = `UPDATE material_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    await this.update(sql, [status, id]);
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
}

let instance: MaterialRecordStorage | null = null;
export const getMaterialRecordStorage = (): MaterialRecordStorage => {
  if (!instance) instance = new MaterialRecordStorage();
  return instance;
};
