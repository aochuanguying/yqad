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

  cached = config;
  return config;
}
