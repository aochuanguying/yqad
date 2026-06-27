/**
 * 发帖历史 MySQL 存储层（带 ChromaDB 同步）
 */

import { MySQLConnectionManager } from '../../utils/mysql-connection-manager';
import { getLogger } from '../../utils/logger';
import { contentDedupStorage } from '../chroma/content-dedup-storage';
import { embeddingVectorizer } from '../../utils/embedding-vectorizer';

const logger = getLogger('post-history-storage');

/**
 * 发帖历史数据库记录
 */
export interface MySQLPostHistory {
  id: string;  // 帖子 ID
  title: string;
  topic: string | null;
  content: string | null;
  image_urls: string | null;  // JSON 字符串
  published_at: Date;
  created_at: Date;
}

/**
 * 创建发帖历史输入
 */
export interface CreatePostHistoryInput {
  id: string;
  title: string;
  topic: string | null;
  content?: string | null;
  imageUrls?: string[];
  publishedAt: Date;
}

/**
 * 发帖历史查询选项
 */
export interface PostHistoryQueryOptions {
  topic?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

class PostHistoryStorage {
  /**
   * 创建发帖历史（带 ChromaDB 同步）
   */
  async createPost(input: CreatePostHistoryInput): Promise<void> {
    const sql = `
      INSERT INTO post_history (
        id, title, topic, content, image_urls, published_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        topic = VALUES(topic),
        content = VALUES(content),
        image_urls = VALUES(image_urls),
        published_at = VALUES(published_at)
    `;

    const params = [
      input.id,
      input.title,
      input.topic,
      input.content || null,
      input.imageUrls ? JSON.stringify(input.imageUrls) : null,
      input.publishedAt,
    ];

    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      await connection.execute(sql, params);
      logger.debug(`创建发帖历史：${input.id}`);
      
      // 同步到 ChromaDB
      await this.syncToChromaDB(input);
    } finally {
      await connection.release();
    }
  }

  /**
   * 同步发帖历史到 ChromaDB
   */
  private async syncToChromaDB(input: CreatePostHistoryInput): Promise<void> {
    try {
      // 检查 ChromaDB 是否已初始化
      if (!contentDedupStorage.isInitialized) {
        logger.debug('ChromaDB 未初始化，跳过同步');
        return;
      }
      
      // 构建向量文本
      const text = `${input.title} ${input.content || ''}`;
      if (!text.trim()) {
        logger.debug('向量文本为空，跳过同步');
        return;
      }
      
      // 生成向量
      const embedding = await embeddingVectorizer.generateEmbedding(text);
      
      // 添加到 ChromaDB
      await contentDedupStorage.addPostVector(
        input.id,
        embedding,
        {
          title: input.title,
          topic: input.topic || undefined,
          created_at: Date.now(),
        }
      );
      
      logger.debug(`发帖历史已同步到 ChromaDB: ${input.id}`);
    } catch (error) {
      logger.error('同步 ChromaDB 失败:', error);
      // 不抛出异常，避免影响主流程
    }
  }

  /**
   * 根据 ID 获取发帖历史
   */
  async getPostById(id: string): Promise<MySQLPostHistory | null> {
    const sql = 'SELECT * FROM post_history WHERE id = ?';
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows] = await connection.execute(sql, [id]);
      const result = Array.isArray(rows) ? (rows as any[])[0] : rows;
      return result || null;
    } finally {
      await connection.release();
    }
  }

  /**
   * 查询发帖历史
   */
  async queryPosts(
    options: PostHistoryQueryOptions
  ): Promise<{ total: number; posts: MySQLPostHistory[] }> {
    let sql = 'SELECT * FROM post_history WHERE 1=1';
    const params: any[] = [];

    if (options.topic) {
      sql += ' AND topic = ?';
      params.push(options.topic);
    }

    if (options.startDate) {
      sql += ' AND published_at >= ?';
      params.push(options.startDate);
    }

    if (options.endDate) {
      sql += ' AND published_at <= ?';
      params.push(options.endDate);
    }

    sql += ' ORDER BY published_at DESC';

    const limit = options.limit || 100;
    const offset = options.offset || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows] = await connection.execute(sql, params);
      const posts = Array.isArray(rows) ? rows : [];

      // 获取总数
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count').replace('LIMIT ? OFFSET ?', '');
      const [countRows] = await connection.execute(countSql, params.slice(0, params.length - 2));
      const total = Array.isArray(countRows) ? (countRows as any)[0]?.count : 0;

      return { total, posts: posts as MySQLPostHistory[] };
    } finally {
      await connection.release();
    }
  }

  /**
   * 【P2-1 新增】语义搜索发帖历史
   * @param query 搜索查询
   * @param nResults 返回结果数量（默认 10）
   * @param minSimilarity 最小相似度阈值（默认 0.6）
   * @returns 语义匹配的发帖历史
   */
  async searchPostsBySemantic(
    query: string,
    nResults: number = 10,
    minSimilarity: number = 0.6
  ): Promise<Array<{
    post: MySQLPostHistory;
    similarity: number;
  }>> {
    try {
      // 1. 生成查询向量
      const embedding = await embeddingVectorizer.generateEmbedding(query);
      
      // 2. 在 ChromaDB 中搜索
      const results = await contentDedupStorage.searchSimilar(embedding, nResults);
      
      // 3. 过滤低相似度结果
      const filteredResults = results.filter(r => r.similarity >= minSimilarity);
      
      // 4. 从 MySQL 获取完整的发帖历史
      const posts: Array<{
        post: MySQLPostHistory;
        similarity: number;
      }> = [];
      
      for (const result of filteredResults) {
        const post = await this.getPostById(result.id);
        if (post) {
          posts.push({
            post,
            similarity: result.similarity,
          });
        }
      }
      
      logger.info(`语义搜索发帖历史："${query}" -> 找到 ${posts.length} 个结果`);
      
      return posts;
    } catch (error) {
      logger.error('语义搜索发帖历史失败:', error);
      return [];
    }
  }

  /**
   * 获取所有发帖历史
   */
  async getAllPosts(): Promise<MySQLPostHistory[]> {
    const sql = 'SELECT * FROM post_history ORDER BY published_at DESC';
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows] = await connection.execute(sql);
      return Array.isArray(rows) ? rows as MySQLPostHistory[] : [];
    } finally {
      await connection.release();
    }
  }

  /**
   * 删除发帖历史（同步删除 ChromaDB 向量）
   */
  async deletePost(id: string): Promise<boolean> {
    const sql = 'DELETE FROM post_history WHERE id = ?';
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      // 1. 从 MySQL 删除
      const [result] = await connection.execute(sql, [id]);
      const deleted = (result as any).affectedRows > 0;
      
      if (deleted) {
        // 2. 同步删除 ChromaDB 向量
        try {
          await contentDedupStorage.deletePostVector(id);
          logger.info(`删除发帖历史及 ChromaDB 向量：${id}`);
        } catch (chromaError) {
          logger.warn(`删除 ChromaDB 向量失败：${id}, 但 MySQL 删除成功`, chromaError);
          // 不抛出错误，避免 MySQL 删除失败
        }
      }
      
      return deleted;
    } finally {
      await connection.release();
    }
  }
}

export const postHistoryStorage = new PostHistoryStorage();

let instance: PostHistoryStorage | null = null;
export const getPostHistoryStorage = (): PostHistoryStorage => {
  if (!instance) instance = new PostHistoryStorage();
  return instance;
};
