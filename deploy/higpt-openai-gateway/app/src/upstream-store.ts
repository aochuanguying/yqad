import fs from 'fs';
import path from 'path';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { GatewayConfig } from './config';

/** 一套大模型上游（地址 + 鉴权参数） */
export interface Upstream {
  id: string;          // 唯一标识，创建后不可改（密钥按 id 保留）
  name: string;        // 展示名
  baseUrl: string;     // e.g. https://inner-apisix.hisense.com/higpt-new/v1
  apiKey: string;      // 放 Authorization: Bearer <apiKey>，可为空
  userKey: string;     // 放 URL 参数 ?user_key=<userKey>，可为空（为空则不带）
  proxyUrl: string;    // 可选，http(s):// 或 socks://
  timeoutMs: number;
  enabled: boolean;
}

/** 客户端模型名 → 某个上游的实际模型 */
export interface ModelRoute {
  name: string;          // 客户端传的 model，如 qwen
  upstreamId: string;
  upstreamModel: string; // 上游实际模型，如 qwen3-5-397b
  // 默认思考：调用方未指定 chat_template_kwargs.enable_thinking 时，网关发送 enable_thinking=<该值>
  thinking: boolean;
  enabled: boolean;
}

/** 网关 API Key（调用方用 Authorization: Bearer <key> 调网关）。只存 SHA-256，明文仅在创建时返回一次。 */
export interface GatewayApiKey {
  id: string;
  name: string;
  hash: string;        // sha256(key) hex
  prefix: string;      // 明文前几位，便于在列表中辨认
  enabled: boolean;
  createdAt: string;
}

export interface UpstreamState {
  revision: number;    // 仅随上游/模型路由的保存递增（网关 Key 的增删改不影响，避免与页面上未保存的路由编辑冲突）
  updatedAt: string;
  upstreams: Upstream[];
  models: ModelRoute[];
  apiKeys: GatewayApiKey[];
}

export interface ResolvedRoute {
  upstream: Upstream;
  route: ModelRoute;
  upstreamModel: string;
}

/** 管理页可见的上游（密钥掩码） */
export interface PublicUpstream extends Omit<Upstream, 'apiKey' | 'userKey'> {
  apiKeyMasked: string;
  userKeyMasked: string;
  hasApiKey: boolean;
  hasUserKey: boolean;
}

export interface PublicApiKey extends Omit<GatewayApiKey, 'hash'> {
  lastUsedAt: string | null;  // 自本次进程启动以来
  useCount: number;
}

export interface PublicState extends Omit<UpstreamState, 'upstreams' | 'apiKeys'> {
  upstreams: PublicUpstream[];
  apiKeys: PublicApiKey[];
}

export class ValidationError extends Error {}
export class RevisionConflictError extends Error {}

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MODEL_RE = /^[A-Za-z0-9._:\/-]{1,128}$/;
const MAX_TIMEOUT_MS = 600000;
const DEFAULT_TIMEOUT_MS = 120000;
const MAX_BACKUPS = 20;

export function maskSecret(v: string): string {
  if (!v) return '';
  if (v.length <= 8) return '****';
  return v.slice(0, 3) + '****' + v.slice(-4);
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

function keyPrefix(key: string): string {
  return key.slice(0, Math.min(8, Math.max(3, key.length - 4)));
}

function makeApiKey(name: string, plain: string): GatewayApiKey {
  return { id: randomUUID(), name, hash: hashKey(plain), prefix: keyPrefix(plain), enabled: true, createdAt: new Date().toISOString() };
}

function normalizeApiKeys(input: unknown): GatewayApiKey[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) fail('apiKeys 必须是数组');
  return (input as any[]).map((k, i) => {
    const hash = str(k?.hash);
    if (!/^[0-9a-f]{64}$/.test(hash)) fail(`网关 Key #${i + 1}: hash 无效`);
    return {
      id: str(k?.id) || randomUUID(),
      name: str(k?.name) || `key-${i + 1}`,
      hash,
      prefix: str(k?.prefix),
      enabled: k?.enabled !== false,
      createdAt: str(k?.createdAt) || new Date().toISOString(),
    };
  });
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function fail(msg: string): never {
  throw new ValidationError(msg);
}

/** 校验并规范化上游与模型路由；不合法抛 ValidationError */
export function normalizeEntries(upstreamsIn: unknown, modelsIn: unknown): { upstreams: Upstream[]; models: ModelRoute[] } {
  if (!Array.isArray(upstreamsIn)) fail('upstreams 必须是数组');
  if (!Array.isArray(modelsIn)) fail('models 必须是数组');

  const upstreams: Upstream[] = [];
  const ids = new Set<string>();
  for (const [i, raw] of (upstreamsIn as any[]).entries()) {
    const u = raw || {};
    const id = str(u.id);
    const label = `上游 #${i + 1}${id ? `(${id})` : ''}`;
    if (!ID_RE.test(id)) fail(`${label}: id 只能包含字母、数字、_、-，长度 1-64`);
    if (ids.has(id)) fail(`${label}: id 重复`);
    ids.add(id);

    const baseUrl = str(u.baseUrl);
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      fail(`${label}: 地址不是合法 URL`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') fail(`${label}: 地址必须是 http:// 或 https://`);

    const proxyUrl = str(u.proxyUrl);
    if (proxyUrl && !/^(https?|socks[45]?h?):\/\//.test(proxyUrl)) fail(`${label}: 代理地址必须以 http://、https:// 或 socks:// 开头`);

    const timeoutMs = u.timeoutMs === undefined || u.timeoutMs === null || u.timeoutMs === ''
      ? DEFAULT_TIMEOUT_MS
      : Number(u.timeoutMs);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
      fail(`${label}: 超时需为 1-${MAX_TIMEOUT_MS} 的整数毫秒`);
    }

    upstreams.push({
      id,
      name: str(u.name) || id,
      baseUrl,
      apiKey: str(u.apiKey),
      userKey: str(u.userKey),
      proxyUrl,
      timeoutMs,
      enabled: u.enabled !== false,
    });
  }

  const models: ModelRoute[] = [];
  const names = new Set<string>();
  for (const [i, raw] of (modelsIn as any[]).entries()) {
    const m = raw || {};
    const name = str(m.name);
    const label = `模型 #${i + 1}${name ? `(${name})` : ''}`;
    if (!MODEL_RE.test(name)) fail(`${label}: 模型名只能包含字母、数字及 . _ : / -，长度 1-128`);
    if (names.has(name)) fail(`${label}: 模型名重复`);
    names.add(name);

    const upstreamId = str(m.upstreamId);
    if (!ids.has(upstreamId)) fail(`${label}: 引用的上游 "${upstreamId}" 不存在`);

    const upstreamModel = str(m.upstreamModel);
    if (!MODEL_RE.test(upstreamModel)) fail(`${label}: 上游模型名不合法`);

    if (m.thinking !== undefined && m.thinking !== null && typeof m.thinking !== 'boolean') fail(`${label}: 默认思考必须是布尔值`);
    // 旧数据无该字段时默认关闭思考（仅取 thinking，旧的 reasoning / disableThinkingParam 字段丢弃）
    models.push({ name, upstreamId, upstreamModel, thinking: m.thinking === true, enabled: m.enabled !== false });
  }

  return { upstreams, models };
}

/** 用 yaml 里旧的 higpt + modelAliases 生成初始配置（迁移用） */
export function seedFromConfig(config: GatewayConfig): UpstreamState {
  const higpt = config.higpt;
  const upstreams: any[] = [];
  const models: any[] = [];
  if (higpt && str(higpt.baseUrl)) {
    upstreams.push({
      id: 'higpt',
      name: 'HiGPT',
      baseUrl: higpt.baseUrl,
      apiKey: higpt.apiKey,
      userKey: higpt.userKey,
      proxyUrl: higpt.proxyUrl || '',
      timeoutMs: higpt.timeoutMs || DEFAULT_TIMEOUT_MS,
      enabled: true,
    });
    for (const [name, upstreamModel] of Object.entries(config.modelAliases || {})) {
      models.push({ name, upstreamId: 'higpt', upstreamModel, enabled: true });
    }
  }
  const normalized = normalizeEntries(upstreams, models);
  return { revision: 1, updatedAt: new Date().toISOString(), ...normalized, apiKeys: seedApiKeys(config) };
}

/** 迁移：把 yaml 里的 gatewayApiKey 导入为第一个网关 Key，保证现有调用方不受影响 */
function seedApiKeys(config: GatewayConfig): GatewayApiKey[] {
  const k = str(config.gatewayApiKey);
  return k ? [makeApiKey('默认（由 yaml gatewayApiKey 导入）', k)] : [];
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function readStateFile(filePath: string): UpstreamState {
  let parsed: any;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    throw new Error(`读取 ${filePath} 失败: ${(e as Error).message}`);
  }
  const normalized = normalizeEntries(parsed?.upstreams, parsed?.models);
  const revision = Number.isInteger(parsed?.revision) && parsed.revision > 0 ? parsed.revision : 1;
  return { revision, updatedAt: str(parsed?.updatedAt) || new Date().toISOString(), ...normalized, apiKeys: normalizeApiKeys(parsed?.apiKeys) };
}

/**
 * 上游配置存储：内存中持有当前配置，转发时每个请求读取最新值，
 * 管理页保存后立即生效；有 filePath 时原子写盘（先备份，再 tmp+rename）。
 */
export class UpstreamStore {
  private state: UpstreamState;
  private usage = new Map<string, { lastUsedAt: string; count: number }>(); // key id -> 使用情况（仅内存）

  private constructor(private readonly filePath: string | null, initial: UpstreamState) {
    this.state = initial;
  }

  /** 仅内存（测试或无持久化场景） */
  static inMemory(initial: UpstreamState): UpstreamStore {
    return new UpstreamStore(null, initial);
  }

  /** 打开文件；不存在则从 yaml 配置迁移生成并写盘。返回 seeded=true 表示本次由 yaml 生成。 */
  static open(filePath: string, config: GatewayConfig): { store: UpstreamStore; seeded: boolean } {
    if (fs.existsSync(filePath)) {
      const store = new UpstreamStore(filePath, readStateFile(filePath));
      // 旧文件没有网关 Key：从 yaml 导入一次并写盘
      if (store.state.apiKeys.length === 0 && str(config.gatewayApiKey)) {
        store.state = { ...store.state, apiKeys: seedApiKeys(config) };
        store.persist(store.state);
      }
      return { store, seeded: false };
    }
    const store = new UpstreamStore(filePath, seedFromConfig(config));
    store.persist(store.state);
    return { store, seeded: true };
  }

  get(): UpstreamState {
    return this.state;
  }

  getPublic(): PublicState {
    return {
      revision: this.state.revision,
      updatedAt: this.state.updatedAt,
      models: this.state.models.map(m => ({ ...m })),
      apiKeys: this.state.apiKeys.map(({ hash, ...rest }) => ({
        ...rest,
        lastUsedAt: this.usage.get(rest.id)?.lastUsedAt || null,
        useCount: this.usage.get(rest.id)?.count || 0,
      })),
      upstreams: this.state.upstreams.map(({ apiKey, userKey, ...rest }) => ({
        ...rest,
        apiKeyMasked: maskSecret(apiKey),
        userKeyMasked: maskSecret(userKey),
        hasApiKey: !!apiKey,
        hasUserKey: !!userKey,
      })),
    };
  }

  /** 解析客户端模型名：先按模型名匹配，再按上游实际模型名匹配 */
  resolve(model: string): ResolvedRoute | null {
    const base = model;
    const { upstreams, models } = this.state;
    const usable = (m: ModelRoute) => m.enabled && upstreams.some(u => u.id === m.upstreamId && u.enabled);
    const route = models.find(m => m.name === base && usable(m))
      || models.find(m => m.upstreamModel === base && usable(m));
    if (!route) return null;
    const upstream = upstreams.find(u => u.id === route.upstreamId)!;
    return { upstream, route, upstreamModel: route.upstreamModel };
  }

  /** /v1/models 展示：可用模型名、上游实际模型名 */
  listModelIds(): string[] {
    const ids = new Set<string>();
    const { upstreams, models } = this.state;
    for (const m of models) {
      if (!m.enabled || !upstreams.some(u => u.id === m.upstreamId && u.enabled)) continue;
      ids.add(m.name);
    }
    for (const m of models) {
      if (!m.enabled || !upstreams.some(u => u.id === m.upstreamId && u.enabled)) continue;
      ids.add(m.upstreamModel);
    }
    return [...ids];
  }

  availableNames(): string[] {
    return this.listModelIds();
  }

  /**
   * 整体替换配置。apiKey/userKey 传空或不传 = 保留该 id 原值；clearApiKey/clearUserKey=true 表示清空。
   * expectedRevision 与当前不一致抛 RevisionConflictError（防止两人同时编辑互相覆盖）。
   */
  replace(input: { revision?: unknown; upstreams?: unknown; models?: unknown }, expectedRevision: number): UpstreamState {
    if (expectedRevision !== this.state.revision) {
      throw new RevisionConflictError(`配置已被修改（当前版本 ${this.state.revision}），请重新加载后再保存`);
    }
    const existing = new Map(this.state.upstreams.map(u => [u.id, u]));
    const keep = (incoming: unknown, clear: unknown, prev: string | undefined) =>
      clear === true ? '' : str(incoming) || prev || '';
    const merged = Array.isArray(input.upstreams)
      ? (input.upstreams as any[]).map(u => {
          const prev = existing.get(str(u?.id));
          return {
            ...u,
            apiKey: keep(u?.apiKey, u?.clearApiKey, prev?.apiKey),
            userKey: keep(u?.userKey, u?.clearUserKey, prev?.userKey),
          };
        })
      : input.upstreams;
    const normalized = normalizeEntries(merged, input.models);
    const next: UpstreamState = {
      revision: this.state.revision + 1,
      updatedAt: new Date().toISOString(),
      ...normalized,
      apiKeys: this.state.apiKeys,
    };
    this.persist(next);
    this.state = next;
    return next;
  }

  // ===== 网关 API Key =====

  /** 校验调用方 key；通过返回 key 记录并记一次使用 */
  verifyApiKey(token: string): GatewayApiKey | null {
    if (!token) return null;
    const h = hashKey(token);
    const k = this.state.apiKeys.find(x => x.enabled && x.hash === h);
    if (!k) return null;
    const u = this.usage.get(k.id);
    this.usage.set(k.id, { lastUsedAt: new Date().toISOString(), count: (u?.count || 0) + 1 });
    return k;
  }

  /** 新建 key，返回明文（只此一次） */
  createApiKey(nameIn: unknown): { key: string; record: GatewayApiKey } {
    const name = str(nameIn);
    if (!name || name.length > 64) fail('名称必填，最长 64 个字符');
    if (this.state.apiKeys.some(k => k.name === name)) fail('名称已存在');
    const plain = 'gw-' + randomBytes(24).toString('base64url');
    const record = makeApiKey(name, plain);
    this.setApiKeys([...this.state.apiKeys, record]);
    return { key: plain, record };
  }

  updateApiKey(id: string, patch: { name?: unknown; enabled?: unknown }): GatewayApiKey {
    const cur = this.state.apiKeys.find(k => k.id === id);
    if (!cur) fail('Key 不存在');
    const next = { ...cur };
    if (patch.name !== undefined) {
      const name = str(patch.name);
      if (!name || name.length > 64) fail('名称必填，最长 64 个字符');
      if (this.state.apiKeys.some(k => k.id !== id && k.name === name)) fail('名称已存在');
      next.name = name;
    }
    if (patch.enabled !== undefined) {
      if (typeof patch.enabled !== 'boolean') fail('enabled 必须是布尔值');
      next.enabled = patch.enabled;
    }
    const list = this.state.apiKeys.map(k => (k.id === id ? next : k));
    this.assertHasEnabled(list);
    this.setApiKeys(list);
    return next;
  }

  deleteApiKey(id: string): void {
    if (!this.state.apiKeys.some(k => k.id === id)) fail('Key 不存在');
    const list = this.state.apiKeys.filter(k => k.id !== id);
    this.assertHasEnabled(list);
    this.setApiKeys(list);
    this.usage.delete(id);
  }

  private assertHasEnabled(list: GatewayApiKey[]): void {
    if (!list.some(k => k.enabled)) fail('至少保留一个启用的网关 Key，否则所有调用方都会被拒绝');
  }

  private setApiKeys(list: GatewayApiKey[]): void {
    const next = { ...this.state, apiKeys: list };
    this.persist(next);
    this.state = next;
  }

  /** 从文件重新加载（手工改了 upstreams.json 后用） */
  reloadFromDisk(): UpstreamState {
    if (!this.filePath) return this.state;
    const next = readStateFile(this.filePath);
    if (next.apiKeys.length === 0) throw new Error('文件中没有网关 Key，拒绝加载（会导致所有调用方被拒绝）');
    this.state = next;
    return this.state;
  }

  private persist(next: UpstreamState): void {
    if (!this.filePath) return;
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(this.filePath)) {
      fs.copyFileSync(this.filePath, `${this.filePath}.bak.${timestamp()}`);
      this.pruneBackups();
    }
    const tmp = `${this.filePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
  }

  private pruneBackups(): void {
    const dir = path.dirname(this.filePath!);
    const prefix = path.basename(this.filePath!) + '.bak.';
    const backups = fs.readdirSync(dir).filter(f => f.startsWith(prefix)).sort();
    for (const f of backups.slice(0, Math.max(0, backups.length - MAX_BACKUPS))) {
      fs.rmSync(path.join(dir, f), { force: true });
    }
  }
}
