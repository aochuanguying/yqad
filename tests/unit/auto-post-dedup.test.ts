/**
 * 测试自动发帖的标题去重逻辑
 * - 新生成标题与历史标题重复时最多重试2次
 * - 重试耗尽则跳过该主题
 * - topicHistory 非空时传递给 generatePost
 *
 * Requirements: 4.4, 4.5, 4.8
 */

jest.mock('../../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'mock', baseUrl: '', timeout: 10000 },
    auth: { username: 'test', password: 'test', tokenStorePath: './data/token.json' },
    ai: { apiKey: 'test-key', baseUrl: 'http://localhost/v1', model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
    openaiGateway: {
      enabled: false,
      port: 3000,
      apiKey: 'gw-test',
      upstream: { baseUrl: 'http://upstream/v1', apiKey: 'up-test', userKey: 'uk-test', proxyUrl: '', timeoutMs: 60000 },
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

jest.mock('../../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockGeneratePost = jest.fn();
jest.mock('../../src/ai/content-generator', () => ({
  generatePost: (...args: any[]) => mockGeneratePost(...args),
}));

jest.mock('../../src/web/services/topics-service', () => {
  let nextTopic: any = null;
  return {
    getNextAvailableTopic: jest.fn(() => nextTopic),
    incrementUseCount: jest.fn(),
    __setNextTopic: (t: any) => { nextTopic = t; },
  };
});

jest.mock('../../src/web/services/materials-service', () => ({
  resolveMaterialPaths: jest.fn(() => []),
}));

jest.mock('../../src/services/global-prompt-service', () => ({
  load: jest.fn(() => null),
}));

import { AutoPostService } from '../../src/services/auto-post';
import { incrementUseCount } from '../../src/web/services/topics-service';

describe('AutoPostService 标题去重逻辑', () => {
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
        topics: ['话题A', '话题B'],
        hotPosts: [],
        analyzedIds: ['post-1'],
        styleDescription: '友好自然的车友交流风格',
        avgPostLength: 300,
        exampleTexts: [],
      }),
    };
    service = new AutoPostService(mockApi, mockAuth, mockAnalysis);
  });

  it('无历史帖子时正常生成，不触发去重', async () => {
    const { __setNextTopic } = require('../../src/web/services/topics-service');
    __setNextTopic({
      id: 'topic-1',
      title: '冬季保养',
      direction: '冬季用车保养',
      outline: '',
      materialPaths: [],
      useCount: 0,
      maxUseCount: 3,
      postHistory: [],
    });

    mockGeneratePost.mockResolvedValue({ title: '冬季保养新帖', content: '内容'.repeat(60) });

    const results = await service.performDailyPosts();

    expect(results[0].success).toBe(true);
    expect(mockGeneratePost).toHaveBeenCalledTimes(1);
    // topicHistory should be undefined when postHistory is empty
    expect(mockGeneratePost).toHaveBeenCalledWith(
      '冬季用车保养',
      expect.any(Array),
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ topicHistory: undefined })
    );
  });

  it('有历史帖子时应将 topicHistory 传给 generatePost', async () => {
    const { __setNextTopic } = require('../../src/web/services/topics-service');
    const postHistory = [
      { title: '历史帖子1', contentSnippet: '内容摘要1', timestamp: '2026-06-01T10:00:00.000Z' },
    ];
    __setNextTopic({
      id: 'topic-1',
      title: '冬季保养',
      direction: '冬季用车保养',
      outline: '',
      materialPaths: [],
      useCount: 1,
      maxUseCount: 3,
      postHistory,
    });

    mockGeneratePost.mockResolvedValue({ title: '冬季保养新角度', content: '不同内容'.repeat(50) });

    const results = await service.performDailyPosts();

    expect(results[0].success).toBe(true);
    expect(mockGeneratePost).toHaveBeenCalledWith(
      '冬季用车保养',
      expect.any(Array),
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ topicHistory: postHistory })
    );
  });

  it('标题与历史重复时应重试，第2次成功', async () => {
    const { __setNextTopic } = require('../../src/web/services/topics-service');
    __setNextTopic({
      id: 'topic-1',
      title: '冬季保养',
      direction: '冬季用车保养',
      outline: '',
      materialPaths: [],
      useCount: 1,
      maxUseCount: 3,
      postHistory: [
        { title: '入冬前必做的5项检查', contentSnippet: '摘要...', timestamp: '2026-06-01T10:00:00.000Z' },
      ],
    });

    // 第一次生成重复标题，第二次生成新标题
    mockGeneratePost
      .mockResolvedValueOnce({ title: '入冬前必做的5项检查', content: '内容A'.repeat(50) })
      .mockResolvedValueOnce({ title: '冬季养车三大要点', content: '内容B'.repeat(50) });

    const results = await service.performDailyPosts();

    expect(results[0].success).toBe(true);
    expect(results[0].title).toBe('冬季养车三大要点');
    expect(mockGeneratePost).toHaveBeenCalledTimes(2);
  });

  it('标题重复连续3次（超过2次重试），应跳过该主题', async () => {
    const { __setNextTopic } = require('../../src/web/services/topics-service');
    __setNextTopic({
      id: 'topic-1',
      title: '冬季保养',
      direction: '冬季用车保养',
      outline: '',
      materialPaths: [],
      useCount: 1,
      maxUseCount: 3,
      postHistory: [
        { title: '入冬前必做的5项检查', contentSnippet: '摘要...', timestamp: '2026-06-01T10:00:00.000Z' },
      ],
    });

    // 所有3次尝试都返回重复标题
    mockGeneratePost.mockResolvedValue({ title: '入冬前必做的5项检查', content: '内容'.repeat(50) });

    const results = await service.performDailyPosts();

    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('标题去重失败');
    expect(mockGeneratePost).toHaveBeenCalledTimes(3); // 1次初始 + 2次重试
    expect(incrementUseCount).not.toHaveBeenCalled();
  });

  it('标题与多条历史帖子中任一重复时应触发重试', async () => {
    const { __setNextTopic } = require('../../src/web/services/topics-service');
    __setNextTopic({
      id: 'topic-1',
      title: '冬季保养',
      direction: '冬季用车保养',
      outline: '',
      materialPaths: [],
      useCount: 2,
      maxUseCount: 5,
      postHistory: [
        { title: '入冬前必做的5项检查', contentSnippet: '摘要1', timestamp: '2026-06-01T10:00:00.000Z' },
        { title: '冬天开车注意事项', contentSnippet: '摘要2', timestamp: '2026-06-05T10:00:00.000Z' },
      ],
    });

    // 第一次与第2条历史重复，第二次生成全新标题
    mockGeneratePost
      .mockResolvedValueOnce({ title: '冬天开车注意事项', content: '内容A'.repeat(50) })
      .mockResolvedValueOnce({ title: '冬季车辆保养实用指南', content: '内容B'.repeat(50) });

    const results = await service.performDailyPosts();

    expect(results[0].success).toBe(true);
    expect(results[0].title).toBe('冬季车辆保养实用指南');
    expect(mockGeneratePost).toHaveBeenCalledTimes(2);
  });

  it('发帖成功后应调用 incrementUseCount 并传递正确的摘要', async () => {
    const { __setNextTopic } = require('../../src/web/services/topics-service');
    __setNextTopic({
      id: 'topic-2',
      title: '自驾游',
      direction: '周末自驾体验',
      outline: '',
      materialPaths: [],
      useCount: 0,
      maxUseCount: 2,
      postHistory: [],
    });

    const longContent = '这是一段比较长的正文内容，用来验证摘要截取逻辑是否正确工作。'.repeat(10);
    mockGeneratePost.mockResolvedValue({ title: '周末自驾好去处', content: longContent });

    const results = await service.performDailyPosts();

    expect(results[0].success).toBe(true);
    expect(incrementUseCount).toHaveBeenCalledWith('topic-2', expect.objectContaining({
      title: '周末自驾好去处',
      contentSnippet: longContent.substring(0, 200),
      timestamp: expect.any(String),
    }));
  });
});
