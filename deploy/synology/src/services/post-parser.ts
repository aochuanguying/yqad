/**
 * 帖子解析器
 */

import { Post } from '../api/types';

export interface ParsedPost {
  id: string;
  title: string;
  fullText: string;
  originalImages: string[];
  author?: string;
  publishTime?: string;
  likeCount?: number;
  commentCount?: number;
}

export class PostParser {
  /**
   * 解析单个帖子
   */
  async parsePost(post: Post): Promise<ParsedPost> {
    return {
      id: post.id || '',
      title: post.title || '',
      fullText: post.content || '',
      originalImages: post.images || [],
      author: post.author,
      publishTime: post.publishTime,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
    };
  }

  /**
   * 批量解析帖子
   */
  async parseAll(posts: Post[]): Promise<ParsedPost[]> {
    return await Promise.all(posts.map(post => this.parsePost(post)));
  }
}
