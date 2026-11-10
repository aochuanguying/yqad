import express, { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { GatewayConfig } from './config';
import { UpstreamStore, ValidationError, RevisionConflictError } from './upstream-store';
import { logger } from './logger';
import { ADMIN_PAGE_HTML } from './admin-page';

const COOKIE_NAME = 'gw_admin';
const DEFAULT_ALLOWED_CIDRS = ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
const DEFAULT_SESSION_TTL_MIN = 480;
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 10 * 60 * 1000;

// ---------- IP 白名单 ----------

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function normalizeIp(ip: string): string {
  const s = (ip || '').trim();
  if (s === '::1') return '127.0.0.1';
  return s.startsWith('::ffff:') ? s.slice(7) : s;
}

export function ipInCidrs(ipRaw: string, cidrs: string[]): boolean {
  const ip = ipv4ToInt(normalizeIp(ipRaw));
  if (ip === null) return false;
  for (const c of cidrs) {
    const [base, bitsStr] = c.split('/');
    const b = ipv4ToInt(base);
    const bits = bitsStr === undefined ? 32 : Number(bitsStr);
    if (b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) continue;
    const size = 2 ** (32 - bits);
    if (Math.floor(ip / size) === Math.floor(b / size)) return true;
  }
  return false;
}

/**
 * 客户端真实 IP：直连方是本机/私网（即 nginx 反代）时信任 nginx 写入的 X-Real-IP，
 * 否则用直连地址（防止公网直连伪造头）。
 */
function clientIp(req: Request): string {
  const peer = normalizeIp(req.socket.remoteAddress || '');
  if (ipInCidrs(peer, DEFAULT_ALLOWED_CIDRS)) {
    const real = req.header('x-real-ip');
    if (real) return normalizeIp(real);
  }
  return peer;
}

// ---------- 会话 ----------

function sha256(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest();
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function isHttps(req: Request): boolean {
  return req.secure || req.header('x-forwarded-proto') === 'https';
}

export interface AdminOptions {
  config: GatewayConfig;
  store: UpstreamStore;
}

/** 挂载管理页与管理 API。未配置 admin.password 时管理页不可用（404）。 */
export function mountAdmin(app: express.Express, { config, store }: AdminOptions): void {
  const password = (config.admin?.password || '').trim();
  const allowedCidrs = config.admin?.allowedCidrs?.length ? config.admin.allowedCidrs : DEFAULT_ALLOWED_CIDRS;
  const ttlMs = (config.admin?.sessionTtlMinutes || DEFAULT_SESSION_TTL_MIN) * 60 * 1000;
  const sessions = new Map<string, number>(); // token -> expiresAt
  const fails = new Map<string, { count: number; lockedUntil: number }>();
  const pageHtml = ADMIN_PAGE_HTML;

  const router = express.Router();

  // 1) 未启用 → 404；2) IP 不在白名单 → 403
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!password) {
      res.status(404).type('text/plain').send('Admin console disabled: set admin.password in config');
      return;
    }
    const ip = clientIp(req);
    if (!ipInCidrs(ip, allowedCidrs)) {
      logger.warn('admin_ip_denied', { ip, path: req.path });
      res.status(403).type('text/plain').send('Forbidden');
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  router.get('/', (req, res) => {
    // 页面里用相对路径 api/...，必须以 /admin/ 访问
    if (!req.originalUrl.split('?')[0].endsWith('/')) {
      res.redirect(301, req.originalUrl.replace(/^([^?]*)/, '$1/'));
      return;
    }
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'");
    res.type('html').send(pageHtml);
  });

  const isAuthed = (req: Request): boolean => {
    const token = parseCookies(req.header('cookie'))[COOKIE_NAME];
    if (!token) return false;
    const exp = sessions.get(token);
    if (!exp) return false;
    if (exp < Date.now()) {
      sessions.delete(token);
      return false;
    }
    return true;
  };

  router.post('/api/login', (req, res) => {
    const ip = clientIp(req);
    const f = fails.get(ip);
    if (f && f.lockedUntil > Date.now()) {
      res.status(429).json({ error: '失败次数过多，请 10 分钟后再试' });
      return;
    }
    const input = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!timingSafeEqual(sha256(input), sha256(password))) {
      const count = (f && f.lockedUntil <= Date.now() && f.count >= LOGIN_MAX_FAILS ? 0 : f?.count || 0) + 1;
      fails.set(ip, { count, lockedUntil: count >= LOGIN_MAX_FAILS ? Date.now() + LOGIN_LOCK_MS : 0 });
      logger.warn('admin_login_failed', { ip, count });
      res.status(401).json({ error: '密码错误' });
      return;
    }
    fails.delete(ip);
    const now = Date.now();
    for (const [t, exp] of sessions) if (exp < now) sessions.delete(t);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, now + ttlMs);
    const cookie = [
      `${COOKIE_NAME}=${token}`,
      'Path=/admin',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${Math.floor(ttlMs / 1000)}`,
      isHttps(req) ? 'Secure' : '',
    ].filter(Boolean).join('; ');
    res.setHeader('Set-Cookie', cookie);
    logger.info('admin_login', { ip });
    res.json({ ok: true });
  });

  // 以下接口需登录；写操作要求自定义头，防跨站请求
  router.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (!isAuthed(req)) {
      res.status(401).json({ error: '未登录或会话已过期' });
      return;
    }
    if (req.method !== 'GET' && req.header('x-admin-request') !== '1') {
      res.status(403).json({ error: '缺少 X-Admin-Request 头' });
      return;
    }
    next();
  });

  router.post('/api/logout', (req, res) => {
    const token = parseCookies(req.header('cookie'))[COOKIE_NAME];
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0`);
    res.json({ ok: true });
  });

  router.get('/api/config', (_req, res) => {
    res.json(store.getPublic());
  });

  router.put('/api/config', (req, res) => {
    const body = req.body || {};
    const expected = Number(body.revision);
    try {
      const next = store.replace(body, expected);
      logger.info('admin_config_saved', {
        ip: clientIp(req),
        revision: next.revision,
        upstreams: next.upstreams.map(u => u.id),
        models: next.models.map(m => `${m.name}->${m.upstreamId}/${m.upstreamModel}`),
      });
      res.json(store.getPublic());
    } catch (e) {
      if (e instanceof RevisionConflictError) {
        res.status(409).json({ error: e.message });
        return;
      }
      if (e instanceof ValidationError) {
        res.status(400).json({ error: e.message });
        return;
      }
      logger.error('admin_config_save_failed', { message: (e as Error).message });
      res.status(500).json({ error: '保存失败：' + (e as Error).message });
    }
  });

  // ===== 网关 API Key（调用方凭证）=====
  const keyError = (res: Response, e: unknown) => {
    if (e instanceof ValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    logger.error('admin_apikey_failed', { message: (e as Error).message });
    res.status(500).json({ error: '操作失败：' + (e as Error).message });
  };

  router.post('/api/keys', (req, res) => {
    try {
      const { key, record } = store.createApiKey(req.body?.name);
      logger.info('admin_apikey_created', { ip: clientIp(req), id: record.id, name: record.name, prefix: record.prefix });
      res.json({ key, record: store.getPublic().apiKeys.find(k => k.id === record.id), apiKeys: store.getPublic().apiKeys });
    } catch (e) {
      keyError(res, e);
    }
  });

  router.patch('/api/keys/:id', (req, res) => {
    try {
      const k = store.updateApiKey(req.params.id, { name: req.body?.name, enabled: req.body?.enabled });
      logger.info('admin_apikey_updated', { ip: clientIp(req), id: k.id, name: k.name, enabled: k.enabled });
      res.json({ apiKeys: store.getPublic().apiKeys });
    } catch (e) {
      keyError(res, e);
    }
  });

  router.delete('/api/keys/:id', (req, res) => {
    try {
      store.deleteApiKey(req.params.id);
      logger.info('admin_apikey_deleted', { ip: clientIp(req), id: req.params.id });
      res.json({ apiKeys: store.getPublic().apiKeys });
    } catch (e) {
      keyError(res, e);
    }
  });

  router.post('/api/reload', (req, res) => {
    try {
      const s = store.reloadFromDisk();
      logger.info('admin_config_reloaded', { ip: clientIp(req), revision: s.revision });
      res.json(store.getPublic());
    } catch (e) {
      res.status(400).json({ error: '重新加载失败，当前配置未变：' + (e as Error).message });
    }
  });

  app.use('/admin', router);
}
