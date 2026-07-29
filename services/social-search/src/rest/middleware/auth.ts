import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../../config/default';

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
