import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../../config/default';
import jwt from 'jsonwebtoken';

// JWT 密钥（从环境变量读取，如果没有则使用默认值）
const JWT_SECRET = process.env.JWT_SECRET || 'social-search-jwt-secret-key-change-in-production';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        username: string;
        role: string;
      };
    }
  }
}

/**
 * API Key 鉴权中间件（用于 REST API）
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', code: 'INVALID_API_KEY' });
    return;
  }

  const apiKey = authHeader.slice(7);
  const config = getConfig();

  if (!config.apiKeys.includes(apiKey)) {
    res.status(401).json({ error: 'Unauthorized', code: 'INVALID_API_KEY' });
    return;
  }

  // 将 apiKey 挂到 req 上供后续使用
  (req as any).apiKey = apiKey;
  next();
}

/**
 * JWT Token 验证中间件（用于管理页面 API）
 */
export function jwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', code: 'MISSING_TOKEN' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { username: string; role: string };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
  }
}

/**
 * 生成 JWT Token
 */
export function generateToken(username: string, role = 'admin'): string {
  return jwt.sign(
    { username, role },
    JWT_SECRET,
    { expiresIn: '24h' } // 24 小时有效期
  );
}

/**
 * 验证用户名密码
 */
export function validateCredentials(username: string, password: string): boolean {
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  
  return username === adminUser && password === adminPass;
}
