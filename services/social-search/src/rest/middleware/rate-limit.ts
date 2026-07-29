import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../../infra/rate-limiter';
import { getConfig } from '../../config/default';

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = (req as any).apiKey || 'anonymous';
  const config = getConfig();

  const result = await checkRateLimit(`apikey:${apiKey}`, config.rateLimit.perKeyPerMinute);

  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());

  if (!result.allowed) {
    res.setHeader('Retry-After', (result.retryAfter || 60).toString());
    res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: result.retryAfter,
    });
    return;
  }

  next();
}
