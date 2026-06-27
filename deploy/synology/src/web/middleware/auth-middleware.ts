/**
 * 认证中间件
 * 
 * 验证用户登录状态，保护 API 和 Web 资源
 */

import { Request, Response, NextFunction } from 'express';
import { loadConfig } from '../../utils/config';
import { getLogger } from '../../utils/logger';

const logger = getLogger('auth-middleware');

/**
 * 扩展 Express Session 类型
 */
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    username?: string;
  }
}

/**
 * 认证中间件函数
 * 检查用户是否已登录
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  const config = loadConfig();
  const authConfig = config.web.auth;
  
  // 如果认证未启用，直接放行
  if (!authConfig || !authConfig.enabled) {
    return next();
  }
  
  // 检查 Session 中是否有认证标记
  const session = req.session as any;
  
  if (session && session.authenticated === true) {
    // 已认证，刷新 Session 有效期
    session.touch = session.touch || (() => {});
    logger.debug(`用户 ${session.username || 'unknown'} 已认证`);
    return next();
  }
  
  // 未认证，根据请求类型返回不同响应
  // 使用 originalUrl 而不是 path，因为路由挂载会改变 path 的值
  const isAPIRequest = req.originalUrl.startsWith('/api/');
  
  if (isAPIRequest) {
    // API 请求返回 401 JSON
    logger.warn(`未授权访问 API: ${req.method} ${req.originalUrl} - IP: ${getClientIP(req)}`);
    res.status(401).json({
      error: '未授权访问',
      code: 'UNAUTHORIZED',
      message: '请先登录',
    });
    return;
  }
  
  // 页面请求重定向到登录页
  logger.warn(`未授权访问页面：${req.path} - IP: ${getClientIP(req)}`);
  
  // 保存原始请求路径，登录后跳转
  const redirectPath = encodeURIComponent(req.originalUrl);
  res.redirect(`/login.html?redirect=${redirectPath}`);
}

/**
 * 公开路由白名单检查
 * 用于在应用认证中间件前跳过某些路由
 */
export function isPublicRoute(path: string, customPublicRoutes?: string[]): boolean {
  const config = loadConfig();
  const authConfig = config.web.auth;
  
  // 默认公开路由
  const defaultPublicRoutes = [
    '/api/auth/login',      // 登录接口
    '/api/auth/status',     // 登录状态查询
    '/api/auth/send-code',  // 发送验证码
    '/api/config',          // 配置接口（登录页面需要）
    '/api/config/ai',       // AI 配置接口
    '/login.html',          // 登录页面
    '/favicon.ico',         // 网站图标
  ];
  
  // 配置中的公开路由（远程发帖 API）
  const configuredPublicRoutes = authConfig?.publicRoutes || [];
  
  // 自定义公开路由（参数传入）
  const extraRoutes = customPublicRoutes || [];
  
  // 合并所有公开路由
  const allPublicRoutes = [...defaultPublicRoutes, ...configuredPublicRoutes, ...extraRoutes];
  
  // 检查路径是否匹配
  for (const route of allPublicRoutes) {
    // 精确匹配
    if (path === route) {
      return true;
    }
    
    // 通配符匹配（支持 /* 后缀）
    if (route.endsWith('/*')) {
      const prefix = route.slice(0, -2);
      if (path.startsWith(prefix + '/')) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * 创建认证中间件（带白名单）
 * 
 * @param publicRoutes 额外的公开路由白名单
 * @returns Express 中间件
 */
export function createAuthMiddleware(publicRoutes?: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // 使用 originalUrl 而不是 path，因为路由挂载会改变 path 的值
    // 检查是否是公开路由
    if (isPublicRoute(req.originalUrl, publicRoutes)) {
      logger.debug(`公开路由跳过认证：${req.originalUrl}`);
      return next();
    }
    
    // 应用认证检查
    return isAuthenticated(req, res, next);
  };
}

/**
 * 获取客户端 IP 地址
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * 审计日志：登录成功
 */
export function logLoginSuccess(req: Request, username: string): void {
  const ip = getClientIP(req);
  logger.info(`[AUTH] 登录成功 - 用户：${username} - IP: ${ip}`);
}

/**
 * 审计日志：登录失败
 */
export function logLoginFailed(req: Request, username: string, reason: string): void {
  const ip = getClientIP(req);
  logger.warn(`[AUTH] 登录失败 - 用户：${username} - IP: ${ip} - 原因：${reason}`);
}

/**
 * 审计日志：未授权访问
 */
export function logUnauthorizedAccess(req: Request): void {
  const ip = getClientIP(req);
  logger.warn(`[AUTH] 未授权访问 - IP: ${ip} - 路径：${req.method} ${req.path}`);
}
