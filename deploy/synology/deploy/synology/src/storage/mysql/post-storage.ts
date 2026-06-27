import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';

/**
 * 帖子数据 MySQL 存储
 */

export interface Post {
  id: string;
  member_id: string;
  title: string;
  content?: string;
  summary?: string;
  cover_image_url?: string;
  status: 'draft' | 'published' | 'deleted';
  view_count: number;
  like_count: number;
  comment_count: number;
  published_at?: Date;
  scheduled_at?: Date;
  featured: boolean;
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePostInput {
  member_id: string;
  title: string;
  content?: string;
  summary?: string;
  cover_image_url?: string;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  summary?: string;
  cover_image_url?: string;
}

export class PostStorage extends BaseDAO {
  /**
   * 创建帖子
   */
  async createPost(input: CreatePostInput): Promise<Post> {
    const id = uuidv4();
    
    const sql = `
      INSERT INTO posts (id, member_id, title, content, summary, cover_image_url, status)
      VALUES (?, ?, ?, ?, ?, ?, 'draft')
    `;
    
    await this.insert(sql, [
      id,
      input.member_id,
      input.title,
      input.content || null,
      input.summary || null,
      input.cover_image_url || null,
    ]);
    
    const post = await this.getPostById(id);
    if (!post) {
      throw new Error('创建帖子失败：无法查询到新创建的帖子');
    }
    return post;
  }

  /**
   * 根据 ID 查询帖子
   */
  async getPostById(id: string): Promise<Post | null> {
    const sql = `SELECT * FROM posts WHERE id = ?`;
    return await this.queryOne<Post>(sql, [id]);
  }

  /**
   * 更新帖子
   */
  async updatePost(id: string, input: UpdatePostInput): Promise<Post | null> {
    const fields: string[] = [];
    const params: any[] = [];

    if (input.title) {
      fields.push('title = ?');
      params.push(input.title);
    }
    if (input.content !== undefined) {
      fields.push('content = ?');
      params.push(input.content);
    }
    if (input.summary !== undefined) {
      fields.push('summary = ?');
      params.push(input.summary);
    }
    if (input.cover_image_url !== undefined) {
      fields.push('cover_image_url = ?');
      params.push(input.cover_image_url);
    }

    if (fields.length === 0) {
      return await this.getPostById(id);
    }

    params.push(id);
    const sql = `UPDATE posts SET ${fields.join(', ')} WHERE id = ?`;
    await this.update(sql, params);
    
    return await this.getPostById(id);
  }

  /**
   * 发布帖子
   */
  async publishPost(id: string): Promise<Post | null> {
    const sql = `
      UPDATE posts 
      SET status = 'published', published_at = NOW() 
      WHERE id = ?
    `;
    await this.update(sql, [id]);
    return await this.getPostById(id);
  }

  /**
   * 软删除帖子
   */
  async deletePost(id: string): Promise<boolean> {
    const sql = `
      UPDATE posts 
      SET status = 'deleted', deleted_at = NOW() 
      WHERE id = ?
    `;
    const affected = await this.update(sql, [id]);
    return affected > 0;
  }

  /**
   * 分页查询帖子列表
   */
  async queryPosts(options?: {
    page?: number;
    pageSize?: number;
    memberId?: string;
    status?: string;
    featured?: boolean;
  }): Promise<{
    data: Post[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    let sql = `SELECT * FROM posts WHERE status = 'published'`;
    const params: any[] = [];

    if (options?.memberId) {
      sql += ` AND member_id = ?`;
      params.push(options.memberId);
    }
    if (options?.status) {
      sql = `SELECT * FROM posts WHERE status = ?`;
      params.push(options.status);
    }
    if (options?.featured !== undefined) {
      sql += ` AND featured = ?`;
      params.push(options.featured ? 1 : 0);
    }

    sql += ` ORDER BY published_at DESC`;

    return await this.queryPaginated<Post>(
      sql,
      params,
      options?.page || 1,
      options?.pageSize || 20
    );
  }

  /**
   * 增加浏览计数
   */
  async incrementViewCount(id: string): Promise<void> {
    const sql = `UPDATE posts SET view_count = view_count + 1 WHERE id = ?`;
    await this.update(sql, [id]);
  }

  /**
   * 增加点赞计数
   */
  async incrementLikeCount(id: string): Promise<void> {
    const sql = `UPDATE posts SET like_count = like_count + 1 WHERE id = ?`;
    await this.update(sql, [id]);
  }

  /**
   * 减少点赞计数
   */
  async decrementLikeCount(id: string): Promise<void> {
    const sql = `UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?`;
    await this.update(sql, [id]);
  }

  /**
   * 增加评论计数
   */
  async incrementCommentCount(id: string): Promise<void> {
    const sql = `UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?`;
    await this.update(sql, [id]);
  }

  /**
   * 减少评论计数
   */
  async decrementCommentCount(id: string): Promise<void> {
    const sql = `UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?`;
    await this.update(sql, [id]);
  }

  /**
   * 设置精选
   */
  async setFeatured(id: string, featured: boolean): Promise<Post | null> {
    const sql = `UPDATE posts SET featured = ? WHERE id = ?`;
    await this.update(sql, [featured ? 1 : 0, id]);
    return await this.getPostById(id);
  }
}

// 导出单例
let postStorageInstance: PostStorage | null = null;

export const getPostStorage = (): PostStorage => {
  if (!postStorageInstance) {
    postStorageInstance = new PostStorage();
  }
  return postStorageInstance;
};

export default PostStorage;
