/**
 * Session 中间件配置
 * 
 * 使用 express-session 提供基于 Cookie 的 Session 支持
 */

import session from 'express-session';
import { loadConfig } from '../../utils/config';
import { getLogger } from '../../utils/logger';

const logger = getLogger('session-middleware');

/**
 * Session 数据扩展接口
 */
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    username?: string;
  }
}

/**
 * 创建并配置 Session 中间件
 * 
 * @returns Express Session 中间件
 */
export function createSessionMiddleware() {
  const config = loadConfig();
  const authConfig = config.web.auth;
  
  // 使用配置的 Session Secret，如果为空则使用默认值（仅开发环境）
  let sessionSecret = authConfig?.sessionSecret;
  if (!sessionSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('生产环境必须配置 sessionSecret！请在 config/local.yaml 中设置 web.auth.sessionSecret');
    } else {
      sessionSecret = 'dev-secret-not-for-production';
      logger.debug('使用开发环境 Session Secret');
    }
  }
  
  // Session 配置
  const sessionOptions: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,           // 不强制保存未修改的 Session
    saveUninitialized: false, // 不为未登录访客创建空 Session
    cookie: {
      httpOnly: true,         // 防止 XSS 攻击
      secure: false,          // 生产环境应设为 true（HTTPS）
      maxAge: authConfig?.sessionMaxAge || 86400000, // 默认 24 小时
      sameSite: 'lax',        // 防止 CSRF
      path: '/',              // Cookie 路径为根路径
    },
    name: 'audi_app_sid',     // Session Cookie 名称
  };
  
  logger.info('Session 中间件已配置（使用 MemoryStore）');
  logger.info('生产环境 Cookie Secure 已禁用（HTTP 访问）');
  
  logger.info('Session 中间件已配置');
  if (typeof sessionOptions.cookie !== 'function' && sessionOptions.cookie) {
    logger.debug(`Session MaxAge: ${sessionOptions.cookie.maxAge}ms`);
  }
  
  return session(sessionOptions);
}
