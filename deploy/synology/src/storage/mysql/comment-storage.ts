import { BaseDAO } from './dao/base-dao';
import { v4 as uuidv4 } from 'uuid';

/**
 * 评论数据 MySQL 存储
 */

export interface Comment {
  id: string;
  post_id: string;
  member_id: string;
  parent_id?: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  ip_address?: string;
  user_agent?: string;
  approved_at?: Date;
  approved_by?: string;
  rejected_at?: Date;
  rejected_by?: string;
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
  edited_at?: Date;
}

export interface CreateCommentInput {
  post_id: string;
  member_id: string;
  parent_id?: string;
  content: string;
  ip_address?: string;
  user_agent?: string;
}

export interface UpdateCommentInput {
  content?: string;
}

export class CommentStorage extends BaseDAO {
  /**
   * 创建评论
   */
  async createComment(input: CreateCommentInput): Promise<Comment> {
    const id = uuidv4();
    
    const sql = `
      INSERT INTO comments (id, post_id, member_id, parent_id, content, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.insert(sql, [
      id,
      input.post_id,
      input.member_id,
      input.parent_id || null,
      input.content,
      input.ip_address || null,
      input.user_agent || null,
    ]);
    
    const comment = await this.getCommentById(id);
    if (!comment) {
      throw new Error('创建评论失败：无法查询到新创建的评论');
    }
    return comment;
  }

  /**
   * 根据 ID 查询评论
   */
  async getCommentById(id: string): Promise<Comment | null> {
    const sql = `SELECT * FROM comments WHERE id = ?`;
    return await this.queryOne<Comment>(sql, [id]);
  }

  /**
   * 根据帖子 ID 查询评论列表
   */
  async getCommentsByPostId(
    postId: string,
    options?: {
      page?: number;
      pageSize?: number;
      status?: string;
    }
  ): Promise<{
    data: Comment[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    let sql = `SELECT * FROM comments WHERE post_id = ? AND status = 'approved'`;
    const params: any[] = [postId];

    if (options?.status) {
      sql = `SELECT * FROM comments WHERE post_id = ? AND status = ?`;
      params[1] = options.status;
    }

    sql += ` ORDER BY created_at ASC`;

    return await this.queryPaginated<Comment>(
      sql,
      params,
      options?.page || 1,
      options?.pageSize || 50
    );
  }

  /**
   * 更新评论
   */
  async updateComment(id: string, input: UpdateCommentInput): Promise<Comment | null> {
    if (!input.content) {
      return await this.getCommentById(id);
    }

    const sql = `
      UPDATE comments 
      SET content = ?, edited_at = NOW() 
      WHERE id = ?
    `;
    await this.update(sql, [input.content, id]);
    
    return await this.getCommentById(id);
  }

  /**
   * 软删除评论
   */
  async deleteComment(id: string): Promise<boolean> {
    const sql = `
      UPDATE comments 
      SET status = 'deleted', deleted_at = NOW() 
      WHERE id = ?
    `;
    const affected = await this.update(sql, [id]);
    return affected > 0;
  }

  /**
   * 审核通过评论
   */
  async approveComment(id: string, approvedBy?: string): Promise<Comment | null> {
    const sql = `
      UPDATE comments 
      SET status = 'approved', approved_at = NOW(), approved_by = ? 
      WHERE id = ?
    `;
    await this.update(sql, [approvedBy || null, id]);
    return await this.getCommentById(id);
  }

  /**
   * 拒绝评论
   */
  async rejectComment(id: string, rejectedBy?: string): Promise<Comment | null> {
    const sql = `
      UPDATE comments 
      SET status = 'rejected', rejected_at = NOW(), rejected_by = ? 
      WHERE id = ?
    `;
    await this.update(sql, [rejectedBy || null, id]);
    return await this.getCommentById(id);
  }

  /**
   * 查询评论树（带回复）
   */
  async getCommentTree(postId: string, maxDepth: number = 3): Promise<any[]> {
    // 获取一级评论
    const rootComments = await this.getCommentsByPostId(postId, { pageSize: 100 });
    
    // 递归获取回复
    const buildTree = async (parentId: string | null, depth: number): Promise<any[]> => {
      if (depth >= maxDepth) return [];
      
      const sql = `SELECT * FROM comments WHERE parent_id = ? AND status = 'approved' ORDER BY created_at ASC`;
      const replies = await this.queryMany<Comment>(sql, [parentId]);
      
      const tree = [];
      for (const reply of replies) {
        const children = await buildTree(reply.id, depth + 1);
        tree.push({
          ...reply,
          children,
        });
      }
      
      return tree;
    };

    const tree = [];
    for (const comment of rootComments.data) {
      const children = await buildTree(comment.id, 0);
      tree.push({
        ...comment,
        children,
      });
    }

    return tree;
  }
}

// 导出单例
let commentStorageInstance: CommentStorage | null = null;

export const getCommentStorage = (): CommentStorage => {
  if (!commentStorageInstance) {
    commentStorageInstance = new CommentStorage();
  }
  return commentStorageInstance;
};

export default CommentStorage;
