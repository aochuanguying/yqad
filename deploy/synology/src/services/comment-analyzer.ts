/**
 * 评论分析器
 */

import { Post } from '../api/types';

export interface PostFeatures {
  postId: string;
  type: 'text-only' | 'image-text-mixed' | 'image-only';
  topic: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  contentLength: number;
  keywords: string[];
  post: Post;
}

export class CommentAnalyzer {
  /**
   * 分析帖子特征
   */
  analyzePost(post: Post): PostFeatures {
    const imageCount = post.images?.length || 0;
    let type: 'text-only' | 'image-text-mixed' | 'image-only';
    
    if (imageCount === 0) {
      type = 'text-only';
    } else if (!post.content || post.content.trim().length === 0) {
      type = 'image-only';
    } else {
      type = 'image-text-mixed';
    }
    
    return {
      postId: post.id || '',
      type,
      topic: '其他',
      sentiment: 'positive',
      contentLength: post.content?.length || 0,
      keywords: [],
      post,
    };
  }
}
