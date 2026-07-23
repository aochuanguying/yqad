// Feature: ai-provider-vision-support, Property 1: Provider supportsVision 读写 round-trip
// **Validates: Requirements 1.2, 1.3**

import fc from 'fast-check';

// Mock logger
jest.mock('../../utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// 内存存储，模拟数据库
let memoryStore: Map<string, any>;

// Mock MySQLConnectionManager
jest.mock('../../utils/mysql-connection-manager', () => {
  const createMockConnection = () => ({
    execute: jest.fn(async (sql: string, params?: any[]) => {
      const sqlUpper = sql.trim().toUpperCase();

      if (sqlUpper.startsWith('SELECT TABLE_NAME')) {
        // 模拟表已存在
        return [[{ TABLE_NAME: 'ai_providers' }]];
      }

      if (sqlUpper.startsWith('SELECT COLUMN_NAME')) {
        // 模拟 supports_vision 字段已存在
        return [[{ COLUMN_NAME: 'supports_vision' }]];
      }

      if (sqlUpper.startsWith('SELECT ID') || sqlUpper.startsWith('SELECT `ID`')) {
        // saveProvider 检查是否存在
        const name = params?.[0];
        if (memoryStore.has(name)) {
          return [[{ id: 1 }]];
        }
        return [[]];
      }

      if (sqlUpper.startsWith('SELECT NAME') || sqlUpper.startsWith('SELECT `NAME`') || sqlUpper.includes('SELECT NAME,')) {
        // getProviderByName / getEnabledProviders / getAllProviders
        const name = params?.[0];
        if (name && memoryStore.has(name)) {
          const record = memoryStore.get(name);
          return [[record]];
        }
        // 如果无参数则返回全部
        if (!params || params.length === 0) {
          return [[...memoryStore.values()]];
        }
        return [[]];
      }

      if (sqlUpper.startsWith('INSERT')) {
        // INSERT 新记录
        const record = parseInsertParams(params || []);
        memoryStore.set(record.name, record);
        return [{ insertId: memoryStore.size }];
      }

      if (sqlUpper.startsWith('UPDATE')) {
        // UPDATE 现有记录
        const record = parseUpdateParams(sql, params || []);
        if (record && memoryStore.has(record.name)) {
          const existing = memoryStore.get(record.name);
          memoryStore.set(record.name, { ...existing, ...record });
        }
        return [{ affectedRows: 1 }];
      }

      if (sqlUpper.startsWith('DELETE')) {
        if (params && params.length > 0) {
          memoryStore.delete(params[0]);
        } else {
          memoryStore.clear();
        }
        return [{ affectedRows: 1 }];
      }

      return [[]];
    }),
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn(async () => {}),
  });

  return {
    MySQLConnectionManager: {
      getInstance: () => ({
        getConnection: jest.fn(async () => createMockConnection()),
      }),
    },
    __esModule: true,
    default: {
      getInstance: () => ({
        getConnection: jest.fn(async () => createMockConnection()),
      }),
    },
  };
});

/**
 * 从 INSERT 参数解析记录
 * saveProvider INSERT: (name, model, base_url, api_key, temperature, max_tokens, request_timeout, enabled, priority, supports_vision)
 */
function parseInsertParams(params: any[]): any {
  return {
    name: params[0],
    model: params[1],
    base_url: params[2],
    api_key: params[3],
    temperature: params[4],
    max_tokens: params[5],
    request_timeout: params[6],
    enabled: params[7] ?? 1,
    priority: params[8] ?? 0,
    supports_vision: params[9],
  };
}

/**
 * 从 UPDATE 参数解析记录
 * saveProvider UPDATE: SET model=?, base_url=?, api_key=?, temperature=?, max_tokens=?, request_timeout=?, supports_vision=? WHERE name=?
 */
function parseUpdateParams(sql: string, params: any[]): any | null {
  // UPDATE 参数顺序: model, baseUrl, apiKey, temperature, maxTokens, requestTimeout, supportsVision, name
  const name = params[params.length - 1]; // WHERE name = ? 是最后一个参数
  return {
    name,
    model: params[0],
    base_url: params[1],
    api_key: params[2],
    temperature: params[3],
    max_tokens: params[4],
    request_timeout: params[5],
    supports_vision: params[6],
  };
}

describe('Property 1: Provider supportsVision 读写 round-trip', () => {
  // 每次测试前重置内存存储和 AIProviderStorage 单例
  beforeEach(() => {
    memoryStore = new Map();
    // 重置 AIProviderStorage 单例的 initialized 状态
    jest.resetModules();
  });

  it('对任意 AIProviderConfig，saveProvider 后 getProviderByName 返回的 supportsVision 值与写入值一致', async () => {
    // 重新引入模块以确保每次 mock 生效
    const { AIProviderStorage } = await import('../../storage/mysql/ai-provider-storage');

    // 通过反射重置单例
    (AIProviderStorage as any).instance = undefined;
    const storage = AIProviderStorage.getInstance();
    // 标记为已初始化，跳过 initialize 的实际数据库检查
    (storage as any).initialized = true;

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          model: fc.string({ minLength: 1, maxLength: 50 }),
          baseUrl: fc.string({ minLength: 1, maxLength: 200 }),
          apiKey: fc.string({ minLength: 1, maxLength: 200 }),
          supportsVision: fc.boolean(),
        }),
        async (config) => {
          // 重置 memory store
          memoryStore.clear();

          // 写入
          await storage.saveProvider({
            name: config.name,
            model: config.model,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            supportsVision: config.supportsVision,
          });

          // 读取
          const result = await storage.getProviderByName(config.name);

          // 验证 round-trip
          expect(result).not.toBeNull();
          expect(result!.supportsVision).toBe(config.supportsVision);
        },
      ),
      { numRuns: 100 },
    );
  });
});
