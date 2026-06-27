import { generateContent, resetAIClient } from '../src/ai/client';
import { resetConfigCache } from '../src/utils/config';

// Mock 依赖
jest.mock('../src/utils/config');
jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock retry to avoid real delays in tests
jest.mock('../src/utils/retry', () => ({
  withRetry: async (fn: () => Promise<any>, _opts: any, _name: string) => fn(),
}));

// Mock openai
jest.mock('openai', () => {
  return jest.fn().mockImplementation((opts: any) => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
    _baseURL: opts.baseURL,
    _apiKey: opts.apiKey,
  }));
});

const { loadConfig } = require('../src/utils/config') as {
  loadConfig: jest.Mock;
};
const OpenAI = require('openai') as jest.Mock;

function makeSuccessResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

function makeConfig(providers: any[]) {
  return {
    ai: {
      apiKey: 'fallback-key',
      baseUrl: 'http://fallback/v1',
      model: 'fallback-model',
      temperature: 0.7,
      maxTokens: 1000,
      providers,
    },
  };
}

describe('AI Client Fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAIClient();
    OpenAI.mockClear();
  });

  const baseOptions = {
    systemPrompt: 'you are helpful',
    userPrompt: 'say hello',
  };

  describe('4.1 单提供商成功调用', () => {
    it('应使用第一个提供商成功返回内容', async () => {
      const providers = [
        { name: 'gpt', apiKey: 'key1', baseUrl: 'http://gpt/v1', model: 'gpt-5', temperature: 0.7, maxTokens: 1000 },
      ];
      loadConfig.mockReturnValue(makeConfig(providers));

      // 设置 OpenAI mock 返回
      const createMock = jest.fn().mockResolvedValue(makeSuccessResponse('Hello!'));
      OpenAI.mockImplementation((opts: any) => ({
        chat: { completions: { create: createMock } },
        _baseURL: opts.baseURL,
      }));

      const result = await generateContent(baseOptions);

      expect(result).toBe('Hello!');
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-5' }),
        expect.any(Object)
      );
    });
  });

  describe('4.2 主力失败时自动切换到备用', () => {
    it('应在第一个提供商失败后使用第二个提供商', async () => {
      const providers = [
        { name: 'gpt', apiKey: 'key1', baseUrl: 'http://gpt/v1', model: 'gpt-5', temperature: 0.7, maxTokens: 1000 },
        { name: 'higpt', apiKey: 'key2', baseUrl: 'http://nas:3000/v1', model: 'higpt', temperature: 0.7, maxTokens: 2000 },
      ];
      loadConfig.mockReturnValue(makeConfig(providers));

      let callCount = 0;
      OpenAI.mockImplementation((opts: any) => ({
        chat: {
          completions: {
            create: jest.fn().mockImplementation(async () => {
              callCount++;
              if (opts.baseURL === 'http://gpt/v1') {
                throw new Error('Connection timeout');
              }
              return makeSuccessResponse('Hi from HiGPT');
            }),
          },
        },
        _baseURL: opts.baseURL,
      }));

      const result = await generateContent(baseOptions);

      expect(result).toBe('Hi from HiGPT');
      expect(callCount).toBe(2); // gpt failed, higpt succeeded
    });
  });

  describe('4.3 所有提供商均失败时抛出聚合错误', () => {
    it('应包含所有错误信息', async () => {
      const providers = [
        { name: 'gpt', apiKey: 'key1', baseUrl: 'http://gpt/v1', model: 'gpt-5', temperature: 0.7, maxTokens: 1000 },
        { name: 'higpt', apiKey: 'key2', baseUrl: 'http://nas:3000/v1', model: 'higpt', temperature: 0.7, maxTokens: 2000 },
      ];
      loadConfig.mockReturnValue(makeConfig(providers));

      OpenAI.mockImplementation((opts: any) => ({
        chat: {
          completions: {
            create: jest.fn().mockImplementation(async () => {
              if (opts.baseURL === 'http://gpt/v1') {
                throw new Error('GPT timeout');
              }
              throw new Error('HiGPT auth failed');
            }),
          },
        },
        _baseURL: opts.baseURL,
      }));

      await expect(generateContent(baseOptions)).rejects.toThrow(
        /所有 LLM 提供商均不可用/
      );
      await expect(generateContent(baseOptions)).rejects.toThrow(/GPT timeout/);
      await expect(generateContent(baseOptions)).rejects.toThrow(/HiGPT auth failed/);
    });
  });

  describe('4.4 旧版配置格式向后兼容归一化', () => {
    it('应将无 providers 的旧配置归一化为单元素数组', () => {
      // 直接测试 normalizeAIConfig 逻辑（通过 loadConfig 行为验证）
      jest.resetModules();
      jest.unmock('../src/utils/config');

      // 使用 fs mock 来模拟旧格式配置
      const configYaml = `
api:
  mode: mock
  baseUrl: http://test
  timeout: 10000
auth:
  username: ""
  password: ""
  tokenStorePath: ./data/token.json
ai:
  apiKey: "old-key"
  baseUrl: http://old-url/v1
  model: old-model
  temperature: 0.5
  maxTokens: 500
signin:
  enabled: true
  maxRetries: 3
comment:
  enabled: true
  dailyLimit: 3
  delayMin: 30
  delayMax: 120
post:
  enabled: true
  dailyLimit: 1
  avoidRepeatDays: 7
analysis:
  postCount: 20
  cacheHours: 24
  storagePath: ./data/analysis.json
scheduler:
  signin:
    cron: "0 8 * * *"
    randomOffsetMin: 0
    randomOffsetMax: 60
  comment:
    cron: "0 10 * * *"
    randomOffsetMin: 0
    randomOffsetMax: 600
  post:
    cron: "0 12 * * *"
    randomOffsetMin: 0
    randomOffsetMax: 360
logging:
  level: info
  dir: ./logs
  retainDays: 30
web:
  enabled: true
  port: 3000
materials:
  basePath: ./data/materials
contentLimits:
  comment:
    min: 20
    max: 200
  post:
    min: 100
    max: 800
`;

      const fs = require('fs');
      const originalReadFileSync = fs.readFileSync;
      const originalExistsSync = fs.existsSync;

      jest.spyOn(fs, 'readFileSync').mockImplementation((...args: unknown[]) => {
        const p = args[0];
        const encoding = args[1];
        if (typeof p === 'string' && p.includes('default.yaml')) {
          return configYaml;
        }
        return originalReadFileSync(p, encoding);
      });
      jest.spyOn(fs, 'existsSync').mockImplementation((...args: unknown[]) => {
        const p = args[0];
        if (typeof p === 'string' && p.includes('local.yaml')) return false;
        return originalExistsSync(p);
      });

      // Re-require to get fresh module
      const { loadConfig: realLoadConfig, resetConfigCache: realReset } = require('../src/utils/config');
      realReset();

      const config = realLoadConfig();
      expect(config.ai.providers).toBeDefined();
      expect(config.ai.providers).toHaveLength(1);
      expect(config.ai.providers[0]).toEqual(
        expect.objectContaining({
          name: 'old-model',
          apiKey: 'old-key',
          baseUrl: 'http://old-url/v1',
          model: 'old-model',
          temperature: 0.5,
          maxTokens: 500,
        })
      );

      jest.restoreAllMocks();
    });
  });
});
