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
  requestTimeout?: number;  // 单个模型的请求超时(毫秒)
}

export interface AppConfig {
  api: {
    mode: 'mock' | 'real';
    baseUrl: string;
    timeout: number;
    deviceId?: string;
    nickName?: string;
    ipRegion?: string;
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
    providerOrder?: string[];        // AI 模型调用顺序，如 ["higpt", "gpt"]
    requestTimeout?: number;         // 单次 AI 请求超时 (毫秒)，默认 30000
    fallback?: {                     // 兜底机制配置
      enabled?: boolean;             // 是否启用兜底机制，默认 true
      mode?: 'fast' | 'robust';      // fast=快速失败 (评论), robust=稳健模式 (发帖)
      maxRetries?: number;           // 最大重试次数，默认 2
      baseDelay?: number;            // 基础等待时间 (ms)，默认 2000
      maxDelay?: number;             // 最大等待时间 (ms)，默认 10000
      providerOrder?: string[];      // 兜底 provider 顺序，默认使用 ai.providerOrder
    };
    timeout?: {                      // 超时控制配置
      global?: number;               // 全局默认超时 (ms)，默认 30000
      connect?: number;              // 连接超时 (ms)
      read?: number;                 // 读取超时 (ms)
      dynamicAdjustment?: boolean;   // 是否启用动态调整，默认 true
      scene?: {                      // 场景级超时
        comment?: number;            // 评论场景超时 (ms)，默认 15000
        post?: number;               // 发帖场景超时 (ms)，默认 60000
        analysis?: number;           // 分析场景超时 (ms)，默认 30000
      };
    };
    rateLimit?: {                    // 速率限制配置
      enabled?: boolean;             // 是否启用，默认 true
      tokensPerMinute?: number;      // 每分钟 token 数，默认 60
      burstSize?: number;            // 突发容量，默认 10
      whitelist?: string[];          // 白名单 provider，不限流
    };
    circuitBreaker?: {               // 熔断器配置
      enabled?: boolean;             // 是否启用，默认 true
      failureThreshold?: number;     // 失败阈值，默认 5
      resetTimeout?: number;         // 恢复超时 (ms)，默认 60000
      halfOpenMaxRequests?: number;  // 半开状态最大请求数，默认 3
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
}

/**
 * 归一化 AI 配置：确保 providers 数组始终存在。
 * 若配置中未声明 providers，将顶层 ai.* 字段包装为单元素数组（向后兼容旧格式）。
 */
function normalizeAIConfig(config: AppConfig): void {
  if (!config.ai.providers || config.ai.providers.length === 0) {
    const apiKey = config.ai.apiKey || '';
    const baseUrl = config.ai.baseUrl || '';
    const model = config.ai.model || '';
    config.ai.providers = [
      {
        name: model || 'default',
        apiKey,
        baseUrl,
        model,
        temperature: config.ai.temperature,
        maxTokens: config.ai.maxTokens,
      },
    ];
  }
}

function normalizeFeaturedPostingConfig(config: AppConfig): void {
  if (!config.featuredPosting) {
    (config as any).featuredPosting = {};
  }
  const fp = (config as any).featuredPosting;
  if (fp.enabled === undefined) fp.enabled = true;
  if (fp.minContentChars === undefined) fp.minContentChars = 250;
  if (fp.minImages === undefined) fp.minImages = 4;
  if (fp.maxImages === undefined) fp.maxImages = 9;  // 精华帖图片数量上限
  if (fp.recommendedImages === undefined) fp.recommendedImages = 6;  // 精华帖推荐图片数量
  if (fp.maxGenerateRetries === undefined) fp.maxGenerateRetries = 2;
  if (fp.maxImageUploadRetries === undefined) fp.maxImageUploadRetries = 2;
}

/**
 * 迁移素材整理调度配置
 * 旧格式：{ cron: string, randomOffsetMin: number, randomOffsetMax: number }
 * 新格式：{ intervalMinutes: number, enabled: boolean }
 */
function migrateMaterialProcessingConfig(config: AppConfig): void {
  const mp = (config.scheduler as any).materialProcessing;
  if (!mp) return;
  
  // 检查是否已经是新格式
  if (typeof mp.intervalMinutes === 'number') {
    return; // 已经是新格式，无需迁移
  }
  
  // 检查是否是旧格式
  if (mp.cron && typeof mp.randomOffsetMax === 'number') {
    // 旧格式 -> 新格式迁移
    // 根据旧配置估算间隔：默认 30 分钟
    mp.intervalMinutes = 30;
    mp.enabled = true;
    
    // 保留旧字段用于向后兼容（但不使用）
    // console.log('素材整理配置已自动迁移为间隔模式：每隔 30 分钟执行一次');
  }
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

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

  // 归一化 AI 配置，确保 providers 数组可用
  normalizeAIConfig(config);
  normalizeFeaturedPostingConfig(config);
  
  // 迁移素材整理调度配置（旧格式 -> 新格式）
  migrateMaterialProcessingConfig(config);

  cachedConfig = config;
  return config;
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
