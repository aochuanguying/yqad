import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

export interface GatewayConfig {
  port: number;
  gatewayApiKey: string;
  higpt: {
    baseUrl: string;
    apiKey: string;
    userKey: string;
    proxyUrl?: string;
    timeoutMs: number;
  };
  modelAliases: Record<string, string>;
  maxRequestBodyKB?: number;
  modelMaxBodyKB?: Record<string, number>;
  // Xinference 上游（embedding / rerank）。可选，未配置则 /v1/embeddings、/v1/rerank 返回 503。
  xinference?: {
    baseUrl: string;              // e.g. http://10.19.197.12:9997
    username: string;             // OAuth2 账号
    password: string;             // OAuth2 密码
    proxyUrl?: string;            // 经 xray 隧道访问内网时用，e.g. http://10.30.5.33:11081
    timeoutMs?: number;           // 默认 60000
    embeddingModels?: string[];   // 支持的 embedding 模型（用于 /v1/models 展示与校验）
    rerankModels?: string[];      // 支持的 rerank 模型
  };
}

let cached: GatewayConfig | null = null;

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source || {})) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function loadConfig(): GatewayConfig {
  if (cached) return cached;

  const configDir = path.resolve(process.cwd(), 'config');
  const defaultPath = path.join(configDir, 'default.yaml');
  const localPath = path.join(configDir, 'local.yaml');

  let config = yaml.parse(fs.readFileSync(defaultPath, 'utf-8')) as GatewayConfig;
  if (fs.existsSync(localPath)) {
    const localConfig = yaml.parse(fs.readFileSync(localPath, 'utf-8'));
    config = deepMerge(config, localConfig) as GatewayConfig;
  }

  if (process.env.PORT) {
    const v = Number(process.env.PORT);
    if (Number.isFinite(v) && v > 0) config.port = v;
  }
  if (process.env.GATEWAY_API_KEY) config.gatewayApiKey = process.env.GATEWAY_API_KEY;
  if (process.env.HIGPT_BASE_URL) config.higpt.baseUrl = process.env.HIGPT_BASE_URL;
  if (process.env.HIGPT_API_KEY) config.higpt.apiKey = process.env.HIGPT_API_KEY;
  if (process.env.HIGPT_USER_KEY) config.higpt.userKey = process.env.HIGPT_USER_KEY;
  if (process.env.HIGPT_PROXY_URL) config.higpt.proxyUrl = process.env.HIGPT_PROXY_URL;
  if (process.env.HIGPT_TIMEOUT_MS) {
    const v = Number(process.env.HIGPT_TIMEOUT_MS);
    if (Number.isFinite(v) && v > 0) config.higpt.timeoutMs = v;
  }

  // Xinference 环境变量覆盖
  if (process.env.XINFERENCE_BASE_URL) {
    config.xinference = config.xinference || ({} as any);
    config.xinference!.baseUrl = process.env.XINFERENCE_BASE_URL;
  }
  if (process.env.XINFERENCE_USERNAME && config.xinference) config.xinference.username = process.env.XINFERENCE_USERNAME;
  if (process.env.XINFERENCE_PASSWORD && config.xinference) config.xinference.password = process.env.XINFERENCE_PASSWORD;
  if (process.env.XINFERENCE_PROXY_URL && config.xinference) config.xinference.proxyUrl = process.env.XINFERENCE_PROXY_URL;

  cached = config;
  return config;
}
