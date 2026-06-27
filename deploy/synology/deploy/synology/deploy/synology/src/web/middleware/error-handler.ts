import { Request, Response, NextFunction } from 'express';
import { getLogger } from '../../utils/logger';

const logger = getLogger('web-error');

/**
 * 全局错误处理中间件
 * 统一格式化 400/401/500 错误响应
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  logger.error(`[${req.method} ${req.path}] ${err.message}`);
  
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? '服务器内部错误' : err.message;
  
  res.status(statusCode).json({
    error: message,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
}
