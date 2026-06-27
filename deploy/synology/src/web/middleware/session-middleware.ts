/**
 * Session 中间件配置
 * 
 * 使用 express-session 提供基于 Cookie 的 Session 支持
 * 生产环境使用 Redis 存储 Session
 */

import session from 'express-session';
import { getRedisClient } from '../../utils/redis-connection-manager';
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
  
  // 生产环境使用 Redis 存储 Session
  if (process.env.NODE_ENV === 'production') {
    try {
      // 动态导入 connect-redis，避免 TypeScript 类型检查问题
      const createRedisStore = Function(`
        const { RedisStore } = require('connect-redis');
        return function(opts) { return new RedisStore(opts); };
      `)();
      
      const redisClient = getRedisClient();
      const store = createRedisStore({
        client: redisClient,
        prefix: 'sess:',  // Session key 前缀
        ttl: authConfig?.sessionMaxAge ? Math.floor(authConfig.sessionMaxAge / 1000) : 86400, // 默认 24 小时
      });
      
      (sessionOptions as any).store = store;
      logger.info('✅ 生产环境 Session 已使用 Redis 存储');
    } catch (error) {
      logger.error('⚠️  Redis Session 存储初始化失败，降级使用 MemoryStore:', error instanceof Error ? error.message : String(error));
    }
  } else {
    logger.info('开发环境使用 MemoryStore');
  }
  
  logger.info('Session 中间件已配置');
  if (typeof sessionOptions.cookie !== 'function' && sessionOptions.cookie) {
    logger.debug(`Session MaxAge: ${sessionOptions.cookie.maxAge}ms`);
  }
  
  return session(sessionOptions);
}
