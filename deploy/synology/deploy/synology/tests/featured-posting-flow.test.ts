jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'mock', baseUrl: '', timeout: 10000 },
    auth: { username: 'test', password: 'test', tokenStorePath: './data/token.json' },
    ai: { apiKey: 'test-key', baseUrl: 'http://localhost/v1', model: 'gpt-4', temperature: 0.7, maxTokens: 1000, providers: [] },
    signin: { enabled: true, maxRetries: 3 },
    comment: { enabled: true, dailyLimit: 3, delayMin: 0, delayMax: 0, maxFetchPages: 1 },
    post: { enabled: true, dailyLimit: 1, avoidRepeatDays: 7 },
    featuredPosting: { enabled: true, minContentChars: 250, minImages: 4, maxGenerateRetries: 0, maxImageUploadRetries: 2 },
    analysis: { postCount: 5, maxCacheCount: 200, storagePath: './data/analysis.json' },
    scheduler: {
      signin: { cron: '0 8 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
      analysis: { cron: '0 9 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
      comment: { cron: '0 10 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
      post: { cron: '0 12 * * *', randomOffsetMin: 0, randomOffsetMax: 0 },
    },
    logging: { level: 'error', dir: './logs', retainDays: 30 },
    web: { enabled: false, port: 3000 },
    materials: { basePath: './data/materials' },
    contentLimits: { comment: { min: 20, max: 200 }, post: { min: 100, max: 500 } },
  }),
  resetConfigCache: jest.fn(),
}));

const mockGeneratePost = jest.fn();
jest.mock('../src/ai/content-generator', () => ({
  generatePost: (...args: any[]) => mockGeneratePost(...args),
}));

jest.mock('../src/services/global-prompt-service', () => ({
  load: jest.fn(() => null),
}));

jest.mock('../src/services/image-selector', () => ({
  selectImages: jest.fn(() => ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']),
  selectFeaturedImageCandidates: jest.fn(() => ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg']),
}));

jest.mock('../src/services/topic-matcher', () => ({
  fetchHotTopics: jest.fn(async () => []),
  matchTopics: jest.fn(async () => []),
}));

jest.mock('../src/web/services/topics-service', () => ({
  getNextAvailableTopic: jest.fn(() => ({
    id: 'topic-1',
    title: '用车体验',
    direction: '奥迪用车体验',
    outline: '',
    materialPaths: [],
    useCount: 0,
    maxUseCount: 3,
    postHistory: [],
  })),
  incrementUseCount: jest.fn(),
}));

import { AutoPostService } from '../src/services/auto-post';

describe('featured posting flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('图片补齐后达标时 mode=featured', async () => {
    mockGeneratePost.mockResolvedValue({ title: '标题A', content: '字'.repeat(260) });

    const mockApi: any = {
      uploadImages: jest.fn()
        .mockResolvedValueOnce({ urls: ['u1', 'u2'], failed: 2 })
        .mockResolvedValueOnce({ urls: ['u3', 'u4'], failed: 0 }),
      publishPost: jest.fn().mockResolvedValue({ success: true, postId: 'p1' }),
    };
    const mockAuth: any = { getAccessToken: jest.fn().mockResolvedValue('t') };
    const mockAnalysis: any = { getSummary: jest.fn().mockResolvedValue({ analyzedIds: ['x'], topics: [], hotPosts: [], styleDescription: '', avgPostLength: 0, exampleTexts: [] }) };

    const svc = new AutoPostService(mockApi, mockAuth, mockAnalysis);
    const results = await svc.performDailyPosts();

    expect(results[0].success).toBe(true);
    expect(results[0].mode).toBe('featured');
    expect(mockApi.uploadImages).toHaveBeenCalledTimes(2);
    const publishArgs = mockApi.publishPost.mock.calls[0];
    expect(publishArgs[3].imageUrls.length).toBe(4);
  });

  it('图片不足导致不达标时应降级为 normal 仍发布', async () => {
    mockGeneratePost.mockResolvedValue({ title: '标题B', content: '字'.repeat(260) });

    const mockApi: any = {
      uploadImages: jest.fn()
        .mockResolvedValueOnce({ urls: ['u1'], failed: 3 })
        .mockResolvedValueOnce({ urls: ['u2'], failed: 3 })
        .mockResolvedValueOnce({ urls: ['u3'], failed: 3 }),
      publishPost: jest.fn().mockResolvedValue({ success: true, postId: 'p2' }),
    };
    const mockAuth: any = { getAccessToken: jest.fn().mockResolvedValue('t') };
    const mockAnalysis: any = { getSummary: jest.fn().mockResolvedValue({ analyzedIds: ['x'], topics: [], hotPosts: [], styleDescription: '', avgPostLength: 0, exampleTexts: [] }) };

    const svc = new AutoPostService(mockApi, mockAuth, mockAnalysis);
    const results = await svc.performDailyPosts();

    expect(results[0].success).toBe(true);
    expect(results[0].mode).toBe('normal');
    expect(mockApi.publishPost).toHaveBeenCalledTimes(1);
  });
});

