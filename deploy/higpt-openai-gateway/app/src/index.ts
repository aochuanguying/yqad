import express, { Request, Response, NextFunction } from 'express';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import path from 'path';
import { GatewayConfig, loadConfig } from './config';
import { UpstreamStore, Upstream, seedFromConfig } from './upstream-store';
import { mountAdmin } from './admin';
import { normalizeThinking, ThinkingParamError } from './thinking';
import { randomUUID } from 'crypto';
import { logger } from './logger';

const JSON_BODY_LIMIT = '10mb'; // 限制最大 10MB，减少 DeepSeek 请求失败

function redact(value: string): string {
  if (!value) return value;
  if (value.length <= 8) return '***';
  return value.slice(0, 4) + '***' + value.slice(-4);
}

function toSafeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.searchParams.has('user_key')) u.searchParams.set('user_key', '***');
    return u.toString();
  } catch {
    return raw;
  }
}

function sendOpenAIError(res: Response, status: number, message: string, type: string, code?: string): void {
  res.status(status).json({ error: { message, type, code } });
}

function getRequestId(req: Request): string {
  const r = req as any;
  if (typeof r.requestId === 'string' && r.requestId) return r.requestId;
  const id = randomUUID();
  r.requestId = id;
  return id;
}

function toErrorMessage(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v instanceof Error) return v.message;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function toOneLine(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function toSafeAxiosErrorLog(e: AxiosError): string {
  const anyErr = e as any;
  const code = e.code ? String(e.code) : '';
  const errno = anyErr.errno ? String(anyErr.errno) : '';
  const syscall = anyErr.syscall ? String(anyErr.syscall) : '';
  const address = anyErr.address ? String(anyErr.address) : '';
  const port = anyErr.port ? String(anyErr.port) : '';
  const status = e.response?.status ? String(e.response.status) : '';
  const msg = toOneLine(toErrorMessage(e));
  const parts = [
    code ? `code=${code}` : '',
    errno ? `errno=${errno}` : '',
    syscall ? `syscall=${syscall}` : '',
    address ? `address=${address}` : '',
    port ? `port=${port}` : '',
    status ? `status=${status}` : '',
    msg ? `message=${msg}` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

/**
 * 带重试的 axios 请求
 * @param requestFn 请求函数
 * @param maxRetries 最大重试次数（不含首次请求）
 * @param retryDelayMs 重试间隔（毫秒）
 */
async function axiosWithRetry<T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 2,
  retryDelayMs: number = 500
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (err: any) {
      lastError = err;
      
      // 最后一次重试失败，直接抛出
      if (attempt === maxRetries) {
        throw err;
      }
      
      // 判断是否需要重试：网络错误、超时、5xx 错误
      const shouldRetry = 
        err.code === 'ECONNABORTED' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'EAI_AGAIN' ||
        (err.response && err.response.status >= 500);
      
      if (!shouldRetry) {
        throw err;
      }
      
      // 等待后重试（指数退避）
      const delay = retryDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

function assertNonEmpty(value: string, name: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${name} 不能为空`);
  }
}

function validateConfig(config: GatewayConfig): void {
  if (!Number.isFinite(config.port) || config.port <= 0) {
    throw new Error('port 配置无效');
  }

  // 网关 API Key 在 upstreams.json 的 apiKeys 中管理（首次启动从 yaml gatewayApiKey 导入），此处不再强制
  // 上游地址/密钥/模型路由由 UpstreamStore 校验（upstreams.json），此处不再要求 higpt.*
}

/** 校验网关 API Key（Authorization: Bearer <key>），每个请求读最新配置，配置页更换后立即生效 */
function requireGatewayAuth(store: UpstreamStore): express.RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const raw = req.header('authorization') || '';
    const token = raw.toLowerCase().startsWith('bearer ') ? raw.slice('bearer '.length).trim() : '';
    const key = store.verifyApiKey(token);
    if (!key) {
      sendOpenAIError(res, 401, 'Unauthorized', 'authentication_error');
      return;
    }
    (req as any).gatewayKeyName = key.name;
    next();
  };
}

function buildUpstreamUrl(upstream: Upstream, pathname: string): string {
  const url = new URL(upstream.baseUrl);
  url.pathname = url.pathname.replace(/\/+$/, '') + pathname;
  if (upstream.userKey) url.searchParams.set('user_key', upstream.userKey);
  return url.toString();
}

function getProxyAgent(upstream: Upstream): any | undefined {
  const proxyUrl = (upstream.proxyUrl || '').trim();
  if (!proxyUrl) return undefined;

  if (proxyUrl.startsWith('socks')) {
    const { SocksProxyAgent } = require('socks-proxy-agent');
    return new SocksProxyAgent(proxyUrl);
  }

  if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    return new HttpsProxyAgent(proxyUrl);
  }

  throw new Error(`Unsupported proxyUrl: ${proxyUrl}`);
}

function buildAxiosConfig(upstream: Upstream): Pick<AxiosRequestConfig, 'timeout' | 'httpAgent' | 'httpsAgent' | 'proxy'> {
  const agent = getProxyAgent(upstream);
  return {
    timeout: upstream.timeoutMs,
    httpAgent: agent,
    httpsAgent: agent,
    proxy: false,
  };
}

// ===== Xinference 上游（embedding / rerank）支持 =====

/** 构建访问 xinference 的 proxy agent（经 xray 隧道访问内网时用） */
function getXinferenceAgent(config: GatewayConfig): any | undefined {
  const proxyUrl = (config.xinference?.proxyUrl || '').trim();
  if (!proxyUrl) return undefined;
  if (proxyUrl.startsWith('socks')) {
    const { SocksProxyAgent } = require('socks-proxy-agent');
    return new SocksProxyAgent(proxyUrl);
  }
  if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
    const { HttpsProxyAgent } = require('https-proxy-agent');
    return new HttpsProxyAgent(proxyUrl);
  }
  throw new Error(`Unsupported xinference.proxyUrl: ${proxyUrl}`);
}

function buildXinferenceAxiosConfig(config: GatewayConfig): Pick<AxiosRequestConfig, 'timeout' | 'httpAgent' | 'httpsAgent' | 'proxy'> {
  const agent = getXinferenceAgent(config);
  return {
    timeout: config.xinference?.timeoutMs || 60000,
    httpAgent: agent,
    httpsAgent: agent,
    proxy: false,
  };
}

// xinference JWT token 缓存（进程内）
let xinfTokenCache: { token: string; fetchedAt: number } | null = null;
const XINF_TOKEN_TTL_MS = 20 * 60 * 1000; // 20 分钟主动刷新（JWT 通常 30 分钟）

/** 获取 xinference token；forceRefresh=true 时强制重新登录（如遇 401） */
async function getXinferenceToken(config: GatewayConfig, forceRefresh = false): Promise<string> {
  const xinf = config.xinference!;
  if (!forceRefresh && xinfTokenCache && (Date.now() - xinfTokenCache.fetchedAt) < XINF_TOKEN_TTL_MS) {
    return xinfTokenCache.token;
  }
  const url = xinf.baseUrl.replace(/\/+$/, '') + '/token';
  const res = await axios.post(
    url,
    { username: xinf.username, password: xinf.password },
    { ...buildXinferenceAxiosConfig(config), headers: { 'content-type': 'application/json' }, validateStatus: () => true }
  );
  if (res.status < 200 || res.status >= 300 || !res.data || !res.data.access_token) {
    throw new Error(`xinference login failed: status=${res.status}`);
  }
  xinfTokenCache = { token: res.data.access_token, fetchedAt: Date.now() };
  return xinfTokenCache.token;
}

/** 转发一个请求到 xinference 指定路径，带 token + 401 自动刷新重试一次 */
async function forwardToXinference(
  config: GatewayConfig,
  pathname: string,
  body: any,
  req: Request,
  res: Response,
): Promise<void> {
  const xinf = config.xinference!;
  const url = xinf.baseUrl.replace(/\/+$/, '') + pathname;
  const requestId = getRequestId(req);
  const startedAt = Date.now();

  const doPost = async (token: string) =>
    axios.post(url, body, {
      ...buildXinferenceAxiosConfig(config),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      responseType: 'json',
      validateStatus: () => true,
    });

  try {
    let token = await getXinferenceToken(config);
    let upstreamRes = await axiosWithRetry(() => doPost(token), 1, 500);

    // token 过期 → 刷新重试一次
    if (upstreamRes.status === 401 || upstreamRes.status === 403) {
      token = await getXinferenceToken(config, true);
      upstreamRes = await doPost(token);
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs > 10000) {
      logger.warn('slow_xinference_request', { durationMs, path: pathname, model: body?.model }, requestId);
    }

    if (upstreamRes.status >= 200 && upstreamRes.status < 300) {
      res.status(upstreamRes.status).json(upstreamRes.data);
      return;
    }
    logger.error('xinference_error_response', { status: upstreamRes.status, path: pathname, model: body?.model }, requestId);
    sendOpenAIError(res, 502, `Xinference error: status=${upstreamRes.status}`, 'upstream_error');
  } catch (err) {
    const e = err as AxiosError;
    logger.error('xinference_request_failed', {
      path: pathname, model: body?.model, errorCode: e.code, errorMessage: toSafeAxiosErrorLog(e),
    }, requestId);
    sendOpenAIError(res, 502, 'Xinference request failed', 'upstream_error');
  }
}

type CreateAppOptions = {
  jsonBodyLimit?: string;
  // 上游配置存储；不传则用 config.higpt + modelAliases 生成仅内存的存储（测试用）
  store?: UpstreamStore;
};

export function createApp(config: GatewayConfig, options: CreateAppOptions = {}): express.Express {
  const app = express();
  const jsonLimit = options.jsonBodyLimit || JSON_BODY_LIMIT;
  const store = options.store || UpstreamStore.inMemory(seedFromConfig(config));

  app.use(express.json({ limit: jsonLimit }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    const id = getRequestId(req);
    res.setHeader('x-request-id', id);
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  mountAdmin(app, { config, store });

  app.use('/v1', requireGatewayAuth(store));

  app.get('/v1/models', (_req, res) => {
    // 列出可用模型名和对应的上游模型名
    // 每次请求读取最新上游配置（管理页保存后立即生效）
    const ids = new Set<string>(store.listModelIds());
    // 加入 xinference 的 embedding / rerank 模型
    if (config.xinference) {
      for (const m of config.xinference.embeddingModels || []) ids.add(m);
      for (const m of config.xinference.rerankModels || []) ids.add(m);
    }
    res.json({ object: 'list', data: [...ids].map(id => ({ id, object: 'model' })) });
  });

  // ===== Embeddings（转发 xinference，标准 OpenAI 格式） =====
  app.post('/v1/embeddings', async (req, res) => {
    const body = req.body as any;
    if (!config.xinference) {
      sendOpenAIError(res, 503, 'Embeddings not configured', 'server_error');
      return;
    }
    if (!body || typeof body !== 'object' || !body.model || body.input === undefined) {
      sendOpenAIError(res, 400, 'Missing required fields: model, input', 'invalid_request_error');
      return;
    }
    const allowed = config.xinference.embeddingModels || [];
    if (allowed.length && !allowed.includes(String(body.model))) {
      sendOpenAIError(res, 400, `Unknown embedding model: ${body.model}. Available: ${allowed.join(', ')}`, 'invalid_request_error');
      return;
    }
    await forwardToXinference(config, '/v1/embeddings', body, req, res);
  });

  // ===== Rerank（转发 xinference） =====
  app.post('/v1/rerank', async (req, res) => {
    const body = req.body as any;
    if (!config.xinference) {
      sendOpenAIError(res, 503, 'Rerank not configured', 'server_error');
      return;
    }
    if (!body || typeof body !== 'object' || !body.model || !body.query || !Array.isArray(body.documents)) {
      sendOpenAIError(res, 400, 'Missing required fields: model, query, documents[]', 'invalid_request_error');
      return;
    }
    const allowed = config.xinference.rerankModels || [];
    if (allowed.length && !allowed.includes(String(body.model))) {
      sendOpenAIError(res, 400, `Unknown rerank model: ${body.model}. Available: ${allowed.join(', ')}`, 'invalid_request_error');
      return;
    }
    await forwardToXinference(config, '/v1/rerank', body, req, res);
  });

  app.post('/v1/chat/completions', async (req, res) => {
    const body = req.body as any;
    if (!body || typeof body !== 'object') {
      sendOpenAIError(res, 400, 'Invalid JSON body', 'invalid_request_error');
      return;
    }
    if (!body.model || !body.messages) {
      sendOpenAIError(res, 400, 'Missing required fields: model, messages', 'invalid_request_error');
      return;
    }
    
    // 检查消息历史长度，防止请求过大
    const rawBodySize = Buffer.byteLength(JSON.stringify(body), 'utf8');
    if (rawBodySize > 500 * 1024) { // 500KB 警告阈值
      logger.warn('large_request_body', { 
        sizeKB: Math.round(rawBodySize / 1024),
        model: body.model,
        messageCount: Array.isArray(body.messages) ? body.messages.length : 0
      }, getRequestId(req));
    }

    // 按模型路由选上游（每个请求读最新配置，管理页保存后立即生效）
    const resolved = store.resolve(String(body.model));
    if (!resolved) {
      sendOpenAIError(res, 400,
        `Unknown model: ${body.model}. Available: ${store.availableNames().join(', ')}`,
        'invalid_request_error');
      return;
    }
    const { upstream, route, upstreamModel } = resolved;
    const isStream = body.stream === true;

    // 思考开关：把各家常见写法（enable_thinking / thinking.type / reasoning / reasoning_effort / thinking_budget 等）
    // 统一成上游认的 chat_template_kwargs.enable_thinking；都没传时用模型路由的“默认思考”。见 thinking.ts。
    let normalized;
    try {
      normalized = normalizeThinking(body, route.thinking);
    } catch (e) {
      if (e instanceof ThinkingParamError) {
        sendOpenAIError(res, 400, e.message, 'invalid_request_error');
        return;
      }
      throw e;
    }
    res.setHeader('x-gateway-thinking', `${normalized.thinking ? 'on' : 'off'};source=${normalized.source}`);

    // 构建上游请求体
    let upstreamBody: any = { ...normalized.body, model: upstreamModel };

    // 所有模型：检查请求体大小，过大则自动截断历史消息
    let bodySize = Buffer.byteLength(JSON.stringify(upstreamBody), 'utf8');
    // 按模型获取阈值：先查 modelMaxBodyKB 表，再用全局 maxRequestBodyKB 兜底
    const modelMaxKB = (config.modelMaxBodyKB && config.modelMaxBodyKB[upstreamModel])
      || config.maxRequestBodyKB
      || 400;
    const MAX_BODY_SIZE = modelMaxKB * 1024;

    if (bodySize > MAX_BODY_SIZE && Array.isArray(upstreamBody.messages)) {
      const originalCount = upstreamBody.messages.length;

      // 保留 system 消息和最后几条消息
      const systemMessages = upstreamBody.messages.filter((m: any) => m.role === 'system');
      let nonSystemMessages = upstreamBody.messages.filter((m: any) => m.role !== 'system');

      // 从前往后移除最旧消息，保留最后至少 5 条
      while (nonSystemMessages.length > 5 && bodySize > MAX_BODY_SIZE) {
        nonSystemMessages = nonSystemMessages.slice(1);
        upstreamBody = { ...upstreamBody, messages: [...systemMessages, ...nonSystemMessages] };
        bodySize = Buffer.byteLength(JSON.stringify(upstreamBody), 'utf8');
      }

      const finalCount = systemMessages.length + nonSystemMessages.length;
      logger.warn('auto_trimmed_large_request', {
        originalCount,
        finalCount,
        removedCount: originalCount - finalCount,
        sizeKB: Math.round(bodySize / 1024),
        model: upstreamModel,
      }, getRequestId(req));
    }
    const upstreamUrl = buildUpstreamUrl(upstream, '/chat/completions');
    const startedAt = Date.now();

    try {
      const upstreamRes = await axiosWithRetry(
        () => axios.post(upstreamUrl, upstreamBody, {
          ...buildAxiosConfig(upstream),
          headers: {
            ...(upstream.apiKey ? { authorization: `Bearer ${upstream.apiKey}` } : {}),
            'content-type': 'application/json',
          },
          responseType: isStream ? 'stream' : 'json',
          validateStatus: () => true,
        }),
        2, // 最多重试 2 次
        500 // 初始重试间隔 500ms
      );

      // 记录成功请求的详细信息（用于调试偶发错误）
      const successDurationMs = Date.now() - startedAt;
      if (successDurationMs > 10000) {
        // 超过 10 秒的慢请求记录日志
        const requestId = getRequestId(req);
        const safeUrl = toSafeUrl(upstreamUrl);
        logger.warn('slow_upstream_request', {
          durationMs: successDurationMs,
          url: safeUrl,
          stream: isStream,
          model: body.model,
          upstreamId: upstream.id,
          upstreamModel,
        }, requestId);
      }

      if (upstreamRes.status >= 200 && upstreamRes.status < 300) {
        if (isStream) {
          // 流式响应
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.status(200);

          // SSE 心跳：在等待上游首个 chunk 期间，定期发送注释行保持连接
          // 防止客户端因上游 prefill 延迟（大上下文时可达 10-25 秒）而超时断开
          let firstChunkReceived = false;
          const heartbeatTimer = setInterval(() => {
            if (!firstChunkReceived) {
              res.write(': heartbeat\n\n');
            }
          }, 5000);

          // 上游响应原样透传
          upstreamRes.data.on('data', () => {
            firstChunkReceived = true;
            clearInterval(heartbeatTimer);
          });
          upstreamRes.data.on('end', () => {
            clearInterval(heartbeatTimer);
          });
          upstreamRes.data.on('error', () => {
            clearInterval(heartbeatTimer);
            if (!res.writableEnded) res.end();
          });
          upstreamRes.data.pipe(res);
        } else {
          // 非流式响应原样透传
          res.status(upstreamRes.status).json(upstreamRes.data);
        }
        return;
      }

      // 上游返回错误状态码
      const durationMs = Date.now() - startedAt;
      const requestId = getRequestId(req);
      const safeProxy = upstream.proxyUrl ? redact(upstream.proxyUrl) : '';
      const safeUrl = toSafeUrl(upstreamUrl);
      const errBodySize = Buffer.byteLength(JSON.stringify(upstreamBody), 'utf8');
      
      if (upstreamRes.status === 401 || upstreamRes.status === 403) {
        logger.error('upstream_auth_error', {
          durationMs,
          status: upstreamRes.status,
          url: safeUrl,
          proxy: safeProxy,
          stream: isStream,
          model: body.model,
          upstreamId: upstream.id,
          upstreamModel,
          bodyBytes: errBodySize,
        }, requestId);
        sendOpenAIError(res, 502, 'Upstream authentication failed', 'upstream_error');
        return;
      }

      logger.error('upstream_error_response', {
        durationMs,
        status: upstreamRes.status,
        url: safeUrl,
        proxy: safeProxy,
        stream: isStream,
        model: body.model,
        upstreamId: upstream.id,
        upstreamModel,
        bodyBytes: errBodySize,
      }, requestId);
      sendOpenAIError(res, 502, `Upstream error: status=${upstreamRes.status}`, 'upstream_error');
    } catch (err) {
      const e = err as AxiosError;
      const durationMs = Date.now() - startedAt;
      const requestId = getRequestId(req);
      const safeProxy = upstream.proxyUrl ? redact(upstream.proxyUrl) : '';
      const safeUrl = toSafeUrl(upstreamUrl);
      const catchBodySize = Buffer.byteLength(JSON.stringify(upstreamBody), 'utf8');
      
      if (e.code === 'ECONNABORTED') {
        logger.error('upstream_timeout', {
          durationMs,
          url: safeUrl,
          proxy: safeProxy,
          stream: isStream,
          model: body.model,
          upstreamId: upstream.id,
          upstreamModel,
          bodyBytes: catchBodySize,
          errorCode: e.code,
          errorMessage: toSafeAxiosErrorLog(e),
        }, requestId);
        sendOpenAIError(res, 504, 'Upstream timeout', 'upstream_timeout');
        return;
      }

      logger.error('upstream_request_failed', {
        durationMs,
        url: safeUrl,
        proxy: safeProxy,
        stream: isStream,
        model: body.model,
        upstreamId: upstream.id,
        upstreamModel,
        bodyBytes: catchBodySize,
        errorCode: e.code,
        errorMessage: toSafeAxiosErrorLog(e),
      }, requestId);
      sendOpenAIError(res, 502, 'Upstream request failed', 'upstream_error');
    }
  });

  app.use((_req, res) => sendOpenAIError(res, 404, 'Not found', 'invalid_request_error'));

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = Number(err?.status) || Number(err?.statusCode) || 500;
    const type = 'invalid_request_error';
    if (err?.type === 'entity.too.large' || status === 413) {
      sendOpenAIError(res, 413, 'Payload too large', type);
      return;
    }
    if (err instanceof SyntaxError && status === 400) {
      sendOpenAIError(res, 400, 'Invalid JSON body', type);
      return;
    }
    sendOpenAIError(res, status, 'Internal server error', 'server_error');
  });

  return app;
}

function start(): void {
  const config = loadConfig();
  validateConfig(config);
  const upstreamsFile = path.resolve(process.cwd(), config.upstreamsFile || 'config/upstreams.json');
  const { store, seeded } = UpstreamStore.open(upstreamsFile, config);
  if (!store.get().apiKeys.some(k => k.enabled)) {
    throw new Error('没有可用的网关 API Key：请在 yaml 设置 gatewayApiKey（首次导入），或在 upstreams.json 的 apiKeys 中启用至少一个');
  }
  const app = createApp(config, { store });
  const state = store.get();

  app.listen(config.port, () => {
    logger.info('server_started', {
      port: config.port,
      upstreamsFile,
      upstreamsSeededFromYaml: seeded,
      upstreams: state.upstreams.map(u => ({ id: u.id, baseUrl: redact(u.baseUrl), enabled: u.enabled })),
      models: state.models.length,
      gatewayApiKeys: state.apiKeys.filter(k => k.enabled).length,
      adminEnabled: !!(config.admin?.password || '').trim(),
    }, undefined, `HiGPT OpenAI gateway listening on :${config.port}`);
  });
}

if (require.main === module) {
  start();
}
