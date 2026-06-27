/**
 * 基础评论服务（MySQL 存储）
 * 
 * 功能：
 * - 评论的 CRUD 操作
 * - 评论树形结构
 * - 评论审核
 */

import { getCommentStorage } from '../storage/mysql/comment-storage';
import { getCommentHistoryStorage } from '../storage/mysql/comment-history-storage';
import { getLogger } from '../utils/logger';

const logger = getLogger('comment-service');

export interface CommentInput {
  post_id: string;
  content: string;
  member_id?: string;
  parent_id?: string;
}

export interface CommentUpdateInput {
  content?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

/**
 * 评论服务类
 */
class CommentService {
  private storage = getCommentStorage();
  private historyStorage = getCommentHistoryStorage();

  /**
   * 创建评论
   */
  async createComment(input: CommentInput) {
    try {
      const comment = await this.storage.createComment({
        post_id: input.post_id,
        content: input.content,
        member_id: input.member_id || 'system',
        parent_id: input.parent_id,
      });
      
      logger.info(`评论创建成功：${comment.id}`);
      return comment;
    } catch (error) {
      logger.error('创建评论失败:', error);
      throw error;
    }
  }

  /**
   * 根据 ID 获取评论
   */
  async getCommentById(commentId: string) {
    return await this.storage.getCommentById(commentId);
  }

  /**
   * 获取帖子的评论列表
   */
  async getCommentsByPostId(postId: string, page: number = 1, pageSize: number = 20) {
    return await this.storage.getCommentsByPostId(postId, { page, pageSize });
  }

  /**
   * 更新评论
   */
  async updateComment(commentId: string, input: CommentUpdateInput) {
    return await this.storage.updateComment(commentId, input);
  }

  /**
   * 审核评论
   */
  async moderateComment(commentId: string, status: 'pending' | 'approved' | 'rejected') {
    const comment = await this.storage.updateComment(commentId, { status });
    
    // 记录审核历史
    await this.historyStorage.logModeration(commentId, status, 'system');
    
    return comment;
  }

  /**
   * 删除评论
   */
  async deleteComment(commentId: string) {
    return await this.storage.deleteComment(commentId);
  }

  /**
   * 获取评论树（嵌套结构）
   */
  async getCommentTree(postId: string) {
    const result = await this.storage.getCommentsByPostId(postId, { pageSize: 1000 });
    const comments = result.data;
    
    // 构建评论树
    const commentMap = new Map();
    const rootComments: any[] = [];
    
    comments.forEach((comment: any) => {
      commentMap.set(comment.id, { ...comment, children: [] });
    });
    
    commentMap.forEach((comment, id) => {
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.children.push(comment);
        }
      } else {
        rootComments.push(comment);
      }
    });
    
    return rootComments;
  }
}

let instance: CommentService | null = null;

export function getCommentService(): CommentService {
  if (!instance) {
    instance = new CommentService();
  }
  return instance;
}
