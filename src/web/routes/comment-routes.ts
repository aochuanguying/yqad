import { Router, Request, Response } from 'express';
import { AuthService } from '../../services/auth';
import { AutoCommentService } from '../../services/auto-comment';
import { RealAudiApi } from '../../api/real-client';
import { getLogger } from '../../utils/logger';
import { loadConfig } from '../../utils/config';
import { verifyApiToken, getTokenStatus } from '../../utils/api-token';
import { getCommentLogStorage } from '../../storage/mysql/comment-log-storage';

const logger = getLogger('comment-routes');

const router = Router();

// 并发控制标志位
let isCommentTaskRunning = false;

// MySQL 评论日志存储
const commentLogStorage = getCommentLogStorage();

/**
 * API Token 鉴权中间件
 * 用于验证远程 API 的独立 Token，与登录 Token 分离（与发帖 API 一致）
 */
async function apiTokenMiddleware(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('鉴权失败：缺少 Authorization 头');
      return res.status(401).json({ error: '缺少 Authorization 头', code: 'UNAUTHORIZED' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      logger.warn('鉴权失败：Token 格式无效');
      return res.status(401).json({ error: 'Token 格式无效', code: 'INVALID_TOKEN' });
    }

    // 特殊标记：从配置文件读取 Token
    if (token === 'configured') {
      const status = await getTokenStatus();
      if (status.configured) {
        logger.info('配置文件 Token 鉴权成功');
        return next();
      }
      logger.warn('配置文件中未配置 Token');
      return res.status(401).json({ error: '配置文件中未配置 Token', code: 'TOKEN_NOT_CONFIGURED' });
    }

    const isValid = await verifyApiToken(token);
    if (!isValid) {
      logger.warn(`鉴权失败：Token 无效 - ${token.substring(0, 10)}...`);
      return res.status(401).json({ error: 'Token 无效', code: 'INVALID_TOKEN' });
    }

    logger.info(`API Token 鉴权成功，Token 前缀：${token.substring(0, 10)}...`);
    next();
  } catch (error: any) {
    logger.error(`API Token 鉴权异常：${error.message}`);
    res.status(401).json({ error: '鉴权失败', code: 'AUTH_FAILED' });
  }
}

/**
 * POST /api/comment/execute
 * 手动触发评论任务（同步执行）
 * 使用 Session 登录状态鉴权
 * 只评论 1 条，不启动调度
 */
router.post('/execute', async (req, res) => {
  try {
    logger.info('收到手动评论触发请求');

    // 检查是否有任务正在运行
    if (isCommentTaskRunning) {
      logger.warn('评论任务正在运行中，拒绝重复执行');
      return res.status(409).json({ 
        error: '评论任务正在运行中，请稍后再试', 
        code: 'TASK_ALREADY_RUNNING' 
      });
    }

    // 设置运行标志
    isCommentTaskRunning = true;

    try {
      // 初始化服务
      const api = new RealAudiApi();
      const authService = await AuthService.create(api);
      const commentService = new AutoCommentService(api, authService);

      // 执行单条评论（只评论 1 条）
      const results = await commentService.performSingleComment();

      // 统计结果
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      logger.info(`手动评论完成：成功 ${successCount} 条，失败 ${failCount} 条`);

      res.json({
        success: true,
        message: '评论任务执行完成',
        data: {
          total: results.length,
          success: successCount,
          failed: failCount,
          results: results.map(r => ({
            postId: r.postId,
            postTitle: r.postTitle,
            success: r.success,
            commentId: r.commentId,
            error: r.error,
          })),
        },
      });
    } finally {
      // 释放运行标志
      isCommentTaskRunning = false;
    }
  } catch (error: any) {
    logger.error(`手动评论任务异常：${error.message}`);
    isCommentTaskRunning = false;
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/comment/logs
 * 获取评论日志列表（从 MySQL 查询）
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    
    // 从 MySQL 查询评论日志
    const result = await commentLogStorage.queryCommentLogs({
      page,
      pageSize,
    });
    
    res.json({
      success: true,
      data: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        logs: result.data,
      },
    });
  } catch (error: any) {
    logger.error(`获取评论日志失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/comment/today-success
 * 查询今天是否有评论成功（使用 API Token 鉴权）
 * 有任意一条成功评论返回 hasSuccess=true，否则 false
 */
router.get('/today-success', apiTokenMiddleware, async (req: Request, res: Response) => {
  try {
    const hasSuccess = await commentLogStorage.hasTodaySuccessComment();
    res.json({
      success: true,
      data: { hasSuccess },
    });
  } catch (error: any) {
    logger.error(`查询今日成功评论失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
