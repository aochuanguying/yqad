/**
 * 测试自动发帖的主题优先和回退逻辑
 */

jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'mock', baseUrl: '', timeout: 10000 },
    auth: { username: 'test', password: 'test', tokenStorePath: './data/token.json' },
    ai: { apiKey: 'test-key', baseUrl: 'http://localhost/v1', model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
    openaiGateway: {
      enabled: false,
      port: 3000,
      apiKey: 'gw-test',
      upstream: {
        baseUrl: 'http://upstream/v1',
        apiKey: 'up-test',
        userKey: 'uk-test',
        proxyUrl: '',
        timeoutMs: 60000,
      },
      modelAliases: { higpt: 'qwen3-5-397b' },
    },
    signin: { enabled: true, maxRetries: 3 },
    comment: { enabled: true, dailyLimit: 3, delayMin: 0, delayMax: 0 },
    post: { enabled: true, dailyLimit: 1, avoidRepeatDays: 7 },
    featuredPosting: { enabled: false, minContentChars: 250, minImages: 4, maxGenerateRetries: 2, maxImageUploadRetries: 2 },
    analysis: { postCount: 5, cacheHours: 24, storagePath: './data/analysis.json' },
    scheduler: {
      signin: { cron: '0 8 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
      comment: { cron: '0 10 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
      post: { cron: '0 12 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
    },
    logging: { level: 'error', dir: './logs', retainDays: 30 },
    web: { enabled: false, port: 3000 },
    materials: { basePath: './data/materials' },
    contentLimits: { comment: { min: 20, max: 200 }, post: { min: 100, max: 800 } },
  }),
  resetConfigCache: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../src/ai/content-generator', () => ({
  generatePost: jest.fn().mockResolvedValue({ title: '测试帖子', content: '测试内容'.repeat(30) }),
}));

jest.mock('../src/web/services/topics-service', () => {
  let nextTopic: any = null;
  return {
    getNextAvailableTopic: jest.fn(() => nextTopic),
    incrementUseCount: jest.fn(),
    __setNextTopic: (t: any) => { nextTopic = t; },
  };
});

jest.mock('../src/web/services/materials-service', () => ({
  getMaterialFilePath: jest.fn((p: string) => `/mnt/nas/materials/${p}`),
  resolveMaterialPaths: jest.fn(() => []),
}));

jest.mock('../src/services/global-prompt-service', () => ({
  load: jest.fn(() => null),
}));

import { AutoPostService } from '../src/services/auto-post';
import { getNextAvailableTopic, incrementUseCount } from '../src/web/services/topics-service';

describe('AutoPostService 主题优先逻辑', () => {
  let service: AutoPostService;
  let mockApi: any;
  let mockAuth: any;
  let mockAnalysis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockApi = {
      publishPost: jest.fn().mockResolvedValue({ success: true, postId: 'post-123' }),
      uploadImages: jest.fn().mockResolvedValue({ urls: ['https://cdn.example.com/img1.jpg'], failed: 0 }),
    };
    mockAuth = {
      getAccessToken: jest.fn().mockResolvedValue('mock_token'),
    };
    mockAnalysis = {
      getSummary: jest.fn().mockResolvedValue({
        topics: ['话题A', '话题B', '话题C'],
        hotPosts: [],
        analyzedIds: ['post-1'],
        styleDescription: '友好自然的车友交流风格',
        avgPostLength: 300,
        exampleTexts: [],
      }),
    };
    service = new AutoPostService(mockApi, mockAuth, mockAnalysis);
  });

  it('有可用主题时应优先使用主题发帖', async () => {
    const { __setNextTopic } = require('../src/web/services/topics-service');
    __setNextTopic({
      id: 'topic-1',
      title: '春季自驾',
      direction: '分享春季自驾体验',
      outline: '1.准备 2.出发',
      materialPaths: ['travel/spring.jpg'],
      useCount: 0,
      maxUseCount: 3,
      postHistory: [],
    });

    const results = await service.performDailyPosts();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].source).toBe('topic');
    expect(incrementUseCount).toHaveBeenCalledWith('topic-1', expect.objectContaining({
      title: '测试帖子',
    }));
  });

  it('无可用主题时应回退到自由生成', async () => {
    const { __setNextTopic } = require('../src/web/services/topics-service');
    __setNextTopic(null);

    const results = await service.performDailyPosts();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].source).toBe('free');
    expect(incrementUseCount).not.toHaveBeenCalled();
  });
});
