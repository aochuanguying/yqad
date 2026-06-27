/**
 * 增强评论服务 API 路由
 * 
 * 功能：
 * 1. 评论情感分析
 * 2. 相似评论搜索
 * 3. 水军评论检测
 * 4. 情感统计
 * 
 * 使用 ChromaDB 进行向量分析和情感聚类
 */

import { Router, Request, Response } from 'express';
import { getEnhancedCommentService } from '../../services/enhanced-comment-service';
import { getLogger } from '../../utils/logger';

const logger = getLogger('enhanced-comment-routes');

const router = Router();
const enhancedCommentService = getEnhancedCommentService();

/**
 * POST /api/comments/analyze-sentiment
 * 分析评论情感
 */
router.post('/analyze-sentiment', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.body;
    
    if (!commentId) {
      return res.status(400).json({
        success: false,
        error: '缺少评论 ID',
      });
    }

    // 获取评论并分析情感
    const comment = await enhancedCommentService.getCommentById(commentId);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: '评论不存在',
      });
    }

    // 返回评论信息（包含情感分析结果）
    res.json({
      success: true,
      data: {
        commentId: comment.id,
        content: comment.content,
        sentiment: (comment as any).sentiment || 'neutral',
        sentimentScore: (comment as any).sentiment_score || 0.5,
        createdAt: comment.created_at,
      },
    });
  } catch (error: any) {
    logger.error(`分析评论情感失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'ANALYSIS_ERROR',
    });
  }
});

/**
 * GET /api/comments/similar
 * 搜索相似评论
 */
router.get('/similar', async (req: Request, res: Response) => {
  try {
    const { query, nResults = 10, minSimilarity = 0.8 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: '缺少查询文本',
      });
    }

    const similarComments = await enhancedCommentService.searchSimilarComments(
      query as string,
      parseInt(nResults as string),
      parseFloat(minSimilarity as string)
    );

    res.json({
      success: true,
      data: {
        query,
        total: similarComments.length,
        comments: similarComments.map(c => ({
          commentId: c.commentId,
          content: c.metadata.comment_text,
          similarity: c.similarity,
          sentiment: c.metadata.sentiment,
          sentimentScore: c.metadata.sentiment_score,
          postId: c.metadata.post_id,
          userId: c.metadata.user_id,
        })),
      },
    });
  } catch (error: any) {
    logger.error(`搜索相似评论失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'SEARCH_ERROR',
    });
  }
});

/**
 * GET /api/comments/suspicious
 * 检测疑似水军评论
 */
router.get('/suspicious', async (req: Request, res: Response) => {
  try {
    const { commentId, timeWindow = 3600 } = req.query;
    
    if (!commentId) {
      return res.status(400).json({
        success: false,
        error: '缺少评论 ID',
      });
    }

    const suspiciousComments = await enhancedCommentService.detectSuspiciousComments(
      commentId as string,
      parseInt(timeWindow as string)
    );

    res.json({
      success: true,
      data: {
        targetCommentId: commentId,
        total: suspiciousComments.length,
        suspiciousComments: suspiciousComments.map(c => ({
          commentId: c.commentId,
          content: c.metadata.comment_text,
          similarity: c.similarity,
          userId: c.metadata.user_id,
          createdAt: c.metadata.created_at,
        })),
      },
    });
  } catch (error: any) {
    logger.error(`检测水军评论失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'DETECTION_ERROR',
    });
  }
});

/**
 * GET /api/comments/sentiment-stats
 * 获取情感统计
 */
router.get('/sentiment-stats', async (req: Request, res: Response) => {
  try {
    const stats = await enhancedCommentService.getSentimentStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error(`获取情感统计失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'STATS_ERROR',
    });
  }
});

export default router;
