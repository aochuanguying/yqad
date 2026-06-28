import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface AIProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  requestTimeout?: number;  // 单个模型的请求超时 (毫秒)
}

export interface AppConfig {
  api: {
    mode: 'mock' | 'real';
    baseUrl: string;
    timeout: number;
    deviceId?: string | null;
    nickName?: string | null;
    ipRegion?: string | null;
  };
  auth: {
    username: string;
    password: string;
  };
  ai: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    queryParams?: Record<string, string>;
    providers?: AIProviderConfig[];
    fallback?: {                     // 兜底机制配置
      enabled?: boolean;             // 是否启用兜底机制，默认 true
      mode?: 'fast' | 'robust';      // fast=快速失败 (评论), robust=稳健模式 (发帖)
      maxRetries?: number;           // 最大重试次数，默认 2
      baseDelay?: number;            // 基础等待时间 (ms)，默认 2000
      maxDelay?: number;             // 最大等待时间 (ms)，默认 10000
      providerOrder?: string[];      // 兜底 provider 顺序，默认使用 ai.providerOrder
    };
  };
  comment: {
    enabled: boolean;
    dailyLimit: number;
    delayMin: number;
    delayMax: number;
    maxFetchPages: number;
  };
  post: {
    enabled: boolean;
    mode?: 'scheduled' | 'api';  // 发帖触发模式：定时或 API
    dailyLimit: number;
    avoidRepeatDays: number;
  };
  featuredPosting: {
    enabled: boolean;
    minContentChars: number;
    minImages: number;
    maxImages: number;        // 图片数量上限
    recommendedImages: number;  // 推荐图片数量（用于精华帖优化）
    maxGenerateRetries: number;
    maxImageUploadRetries: number;
  };
  analysis: {
    postCount: number;
    maxCacheCount: number;
  };
  scheduler: {
    comment: { cron: string; randomOffsetMin: number; randomOffsetMax: number };
    post: { cron: string; randomOffsetMin: number; randomOffsetMax: number };
    materialProcessing: { 
      cron?: string; 
      randomOffsetMin?: number; 
      randomOffsetMax?: number;
      intervalMinutes?: number;  // 新增：间隔模式（分钟）
      enabled?: boolean;          // 新增：是否启用间隔模式
    };
  };
  web: {
    enabled: boolean;
    port: number;
    baseUrl?: string;  // Web 服务的基础 URL，用于生成图片下载链接
    auth?: {
      enabled: boolean;
      username: string;
      passwordHash: string;
      sessionSecret: string;
      sessionMaxAge: number;  // Session 最大存活时间（毫秒）
      publicRoutes?: string[];  // 不需要认证的路由白名单
    };
  };
  materials: {
    basePath: string;
    rawPath?: string;
    processedPath?: string;
    processing?: {
      enabled?: boolean;
      outputFormat?: 'jpeg';
      jpegQuality?: number;
      enableVision?: boolean;
      maxFilesPerRun?: number;
      heicFallback?: {
        enabled?: boolean;
        command?: string;
        timeoutMs?: number;
      };
    };
  };
  contentLimits: {
    comment: { min: number; max: number };
    post: { min: number; max: number };
  };
  openaiGateway?: {
    enabled: boolean;
    port: number;
    apiKey: string;
    upstream: {
      baseUrl: string;
      apiKey: string;
      userKey: string;
      proxyUrl: string;
      timeoutMs: number;
    };
    modelAliases: Record<string, string>;
  };
  internetReference?: {
    enabled?: boolean;
    searchKeywords?: string[];
    maxResults?: number;
    timeout?: number;
    rateLimitPerHour?: number;
    platform?: string;
    watermarkRemoval?: {
      enabled?: boolean;
      timeout?: number;
      maxRetries?: number;
      batchSize?: number;
    };
  };
  vehicleMonitor?: {
    enabled: boolean;
    intervalMinutes: number;
    quickIntervalMinutes: number;
    safeDistanceMeters: number;
    alertPhone: string;
    moveThresholdMeters: number;
    minBatteryVolt: number;
    haBaseUrl: string;
    haToken: string;
    deviceTrackerEntity: string;
    token: string;
  };
  autojsApi?: {
    enabled: boolean;
    baseUrl: string;
    apiToken: string;
    postScript: string;
  };
  telecomApi?: {
    enabled: boolean;
    apiUrl: string;
    apiToken: string;
    alertPhone: string;
  };
  // 【第一步优化】合规性检查相关配置
  contentDeduplication?: {
    enabled?: boolean;
    similarityThreshold?: number;
    historyDays?: number;
    checkDays?: number;
    titleWeight?: number;
  };
  sensitiveWordFilter?: {
    enabled?: boolean;
    customWords?: string[];
  };
  contentQualityScoring?: {
    enabled?: boolean;
    minScore?: number;
    weights?: {
      completeness?: number;
      originality?: number;
      diversity?: number;
      appeal?: number;
    };
  };
  postingIntervalControl?: {
    enabled?: boolean;
    minIntervalDays?: number;
    whitelist?: string[];
    enableEmergencyOverride?: boolean;
  };
  complianceCheckReport?: {
    enabled?: boolean;
    retainDays?: number;
  };
  // 【第三步优化】混合素材配置
  hybridMaterial?: {
    enabled?: boolean;
    priorityMode?: 'local-first' | 'internet-first' | 'hybrid';
    localRatio?: number;
    internetRatio?: number;
  };
  // 【增强评论服务】配置
  enhancedCommentService?: {
    enabled?: boolean;
    enableSentimentAnalysis?: boolean;  // 是否启用情感分析
    enableSuspiciousDetection?: boolean;  // 是否启用疑似水军检测
    logOnly?: boolean;  // 仅记录日志，不影响主流程（默认 true）
  };
  // 互联网搜索配置
  internetSearch?: {
    enabled?: boolean;
    xiaohongshuCookie?: string;
    zhihuAccessSecret?: string;
    platforms?: Array<{
      name: string;
      enabled: boolean;
      priority: number;
    }>;
  };
}

/**
 * 归一化 AI 配置：确保 providers 数组始终存在。
 * 若配置中未声明 providers，将顶层 ai.* 字段包装为单元素数组（向后兼容旧格式）。
 */
function normalizeAIConfig(config: AppConfig): void {
  // 如果 config.ai 不存在，初始化为空对象
  if (!config.ai) {
    config.ai = {};
  }
  
  // providers 从数据库读取，这里不处理（由应用启动时注入）
}

/**
 * 初始化 API 配置默认值（如果配置文件未定义）
 */
function normalizeApiConfig(config: AppConfig): void {
  if (!config.api) {
    config.api = {
      mode: 'mock',
      baseUrl: 'http://127.0.0.1:9000',
      timeout: 5000,
    };
  }
}

/**
 * 初始化 Scheduler 配置默认值（如果配置文件未定义）
 */
function normalizeSchedulerConfig(config: AppConfig): void {
  if (!config.scheduler) {
    config.scheduler = {
      comment: {
        cron: '0 9-21 * * *',
        randomOffsetMin: 0,
        randomOffsetMax: 30,
      },
      post: {
        cron: '0 10,14,20 * * *',
        randomOffsetMin: 0,
        randomOffsetMax: 30,
      },
      materialProcessing: {
        intervalMinutes: 30,
        enabled: true,
      },
    };
  }
}

/**
 * 初始化 Post 配置默认值（如果配置文件未定义）
 */
function normalizePostConfig(config: AppConfig): void {
  if (!config.post) {
    config.post = {
      enabled: true,
      mode: 'scheduled',
      dailyLimit: 10,
      avoidRepeatDays: 7,
    };
  }
}

function normalizeFeaturedPostingConfig(config: AppConfig): void {
  // 从数据库读取，配置文件不设置默认值
  if (!config.featuredPosting) {
    (config as any).featuredPosting = {};
  }
}

/**
 * 迁移素材整理调度配置
 * 旧格式：{ cron: string, randomOffsetMin: number, randomOffsetMax: number }
 * 新格式：{ intervalMinutes: number, enabled: boolean }
 */
function migrateMaterialProcessingConfig(config: AppConfig): void {
  // 从数据库读取，配置文件不处理
}

let cachedConfig: AppConfig | null = null;
let aiProvidersInitialized = false;

export function loadConfig(): AppConfig {
  if (cachedConfig && cachedConfig.ai?.providers !== undefined) return cachedConfig;

  const configPath = path.resolve(process.cwd(), 'config/default.yaml');
  const localConfigPath = path.resolve(process.cwd(), 'config/local.yaml');

  const defaultContent = fs.readFileSync(configPath, 'utf-8');
  let config = yaml.parse(defaultContent) as AppConfig;

  // 合并本地配置（如果存在）
  if (fs.existsSync(localConfigPath)) {
    const localContent = fs.readFileSync(localConfigPath, 'utf-8');
    const localConfig = yaml.parse(localContent);
    config = deepMerge(config, localConfig);
  }

  // 环境变量覆盖
  if (process.env.AI_API_KEY) config.ai.apiKey = process.env.AI_API_KEY;
  if (process.env.AI_BASE_URL) config.ai.baseUrl = process.env.AI_BASE_URL;
  if (process.env.AUTH_USERNAME) config.auth.username = process.env.AUTH_USERNAME;
  if (process.env.AUTH_PASSWORD) config.auth.password = process.env.AUTH_PASSWORD;
  
  // Web 认证环境变量覆盖
  if (process.env.WEB_AUTH_USERNAME && config.web.auth) {
    config.web.auth.username = process.env.WEB_AUTH_USERNAME;
  }
  if (process.env.WEB_AUTH_PASSWORD_HASH && config.web.auth) {
    config.web.auth.passwordHash = process.env.WEB_AUTH_PASSWORD_HASH;
  }
  if (process.env.WEB_AUTH_SESSION_SECRET && config.web.auth) {
    config.web.auth.sessionSecret = process.env.WEB_AUTH_SESSION_SECRET;
  }
  if (process.env.WEB_AUTH_ENABLED && config.web.auth) {
    config.web.auth.enabled = process.env.WEB_AUTH_ENABLED === 'true';
  }

  // 归一化 AI 配置
  normalizeAIConfig(config);
  normalizeApiConfig(config);
  normalizeSchedulerConfig(config);
  normalizePostConfig(config);
  normalizeFeaturedPostingConfig(config);
  
  // 迁移素材整理调度配置（旧格式 -> 新格式）
  migrateMaterialProcessingConfig(config);

  // 如果已经初始化过 AI providers，尝试从数据库重新加载
  if (aiProvidersInitialized && !config.ai?.providers) {
    try {
      const { AIProviderStorage } = require('../storage/mysql/ai-provider-storage');
      const storage = AIProviderStorage.getInstance();
      // 同步读取（假设数据库连接已建立）
      const promise = storage.getEnabledProviders();
      promise.then((providers: any[]) => {
        if (cachedConfig && cachedConfig.ai) {
          cachedConfig.ai.providers = providers;
        }
      }).catch((err: any) => {
        console.warn('[Config] 异步加载 AI Provider 失败:', err.message);
      });
    } catch (error: any) {
      // 忽略错误，providers 会在下次 loadAIProvidersFromDB 时加载
    }
  }

  cachedConfig = config;
  return config;
}

/**
 * 从数据库加载 AI Provider 并更新缓存
 * 必须在 MySQL 初始化完成后调用
 */
export async function loadAIProvidersFromDB(): Promise<void> {
  try {
    const { AIProviderStorage } = await import('../storage/mysql/ai-provider-storage');
    const storage = AIProviderStorage.getInstance();
    const providers = await storage.getEnabledProviders();
    
    if (!cachedConfig) {
      loadConfig();
    }
    
    if (!cachedConfig!.ai) cachedConfig!.ai = {};
    cachedConfig!.ai.providers = providers;
    aiProvidersInitialized = true;
    
    console.log(`[Config] 从数据库加载了 ${providers.length} 个 AI Provider`);
    console.log(`[Config] 缓存配置中的 providers: ${JSON.stringify(providers.map(p => p.name))}`);
  } catch (error: any) {
    console.warn('[Config] 从数据库读取 AI Provider 失败:', error.message);
    if (!cachedConfig) cachedConfig = loadConfig();
    if (!cachedConfig!.ai) cachedConfig!.ai = {};
    cachedConfig!.ai.providers = [];
    aiProvidersInitialized = true;
  }
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}
