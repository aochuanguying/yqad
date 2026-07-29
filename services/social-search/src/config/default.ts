export interface AppConfig {
  port: number;
  mysql: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  redis: {
    host: string;
    port: number;
    db: number;
    keyPrefix: string;
  };
  apiKeys: string[];
  rateLimit: {
    perPlatformPerMinute: number;  // 每平台每分钟最大请求数
    perKeyPerMinute: number;       // 每 API Key 每分钟最大请求数
  };
  cache: {
    ttl: number;  // 缓存 TTL（秒）
  };
  zhihuAccessSecret: string;
  pythonExecutable: string;
  scriptsDir: string;
}

let config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (config) return config;

  config = {
    port: parseInt(process.env.PORT || '3090', 10),
    mysql: {
      host: process.env.MYSQL_HOST || '192.168.50.10',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'Wfw7539148@',
      database: process.env.MYSQL_DATABASE || 'yqad_prod_db',
    },
    redis: {
      host: process.env.REDIS_HOST || '192.168.50.10',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB || '2', 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'social-search:',
    },
    apiKeys: (process.env.API_KEYS || 'dev-test-key').split(',').map(k => k.trim()),
    rateLimit: {
      perPlatformPerMinute: parseInt(process.env.RATE_LIMIT_PLATFORM || '10', 10),
      perKeyPerMinute: parseInt(process.env.RATE_LIMIT_KEY || '30', 10),
    },
    cache: {
      ttl: parseInt(process.env.CACHE_TTL || '600', 10),
    },
    zhihuAccessSecret: process.env.ZHIHU_ACCESS_SECRET || '',
    pythonExecutable: process.env.PYTHON_EXECUTABLE || 'python3',
    scriptsDir: process.env.SCRIPTS_DIR || require('path').join(__dirname, '../../scripts'),
  };

  return config;
}
