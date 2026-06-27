import { MockAudiApi } from '../src/api/mock-client';
import { AuthService } from '../src/services/auth';
import { SigninService } from '../src/services/signin';
import { ContentAnalysisService } from '../src/services/content-analysis';
import { AutoCommentService } from '../src/services/auto-comment';
import { AutoPostService } from '../src/services/auto-post';
import { generateDailySummary } from '../src/services/daily-summary';
import * as fs from 'fs';
import * as path from 'path';

jest.setTimeout(30000);

// Mock config for tests
jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'mock', baseUrl: '', timeout: 10000 },
    auth: { username: 'test', password: 'test', tokenStorePath: './data/test-token.json' },
    ai: { apiKey: 'test-key', baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo', temperature: 0.7, maxTokens: 1000 },
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
    comment: { enabled: true, dailyLimit: 2, delayMin: 0, delayMax: 1 },
    post: { enabled: true, dailyLimit: 1, avoidRepeatDays: 7 },
    featuredPosting: { enabled: false, minContentChars: 250, minImages: 4, maxGenerateRetries: 2, maxImageUploadRetries: 2 },
    analysis: { postCount: 5, cacheHours: 24, storagePath: './data/test-analysis.json' },
    scheduler: {
      signin: { cron: '0 8 * * *', randomOffsetMin: 0, randomOffsetMax: 60 },
      comment: { cron: '0 10 * * *', randomOffsetMin: 0, randomOffsetMax: 600 },
      post: { cron: '0 12 * * *', randomOffsetMin: 0, randomOffsetMax: 360 },
    },
    logging: { level: 'error', dir: './logs', retainDays: 30 },
    web: { enabled: false, port: 3000 },
    materials: { basePath: './data/materials' },
    contentLimits: { comment: { min: 20, max: 200 }, post: { min: 100, max: 800 } },
  }),
  resetConfigCache: () => {},
}));

// Mock AI content generation (不实际调用OpenAI)
jest.mock('../src/ai/content-generator', () => ({
  generateComment: async (post: any) => ({
    content: `这是针对"${post.title}"的测试评论，内容足够长以满足最小长度限制要求。`,
  }),
  generatePost: async (topic: string) => ({
    title: `关于${topic}的测试帖子`,
    content: '这是一篇测试帖子的正文内容。'.repeat(10) + '内容涵盖了多个方面的讨论和分享。',
  }),
}));

describe('端到端测试：模拟完整一天执行流程', () => {
  let api: MockAudiApi;
  let authService: AuthService;
  let signinService: SigninService;
  let analysisService: ContentAnalysisService;
  let commentService: AutoCommentService;
  let postService: AutoPostService;

  beforeAll(() => {
    // 确保数据目录存在
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  });

  beforeEach(() => {
    api = new MockAudiApi();
    authService = new AuthService(api);
    signinService = new SigninService(api, authService);
    analysisService = new ContentAnalysisService(api, authService);
    commentService = new AutoCommentService(api, authService, analysisService);
    postService = new AutoPostService(api, authService, analysisService);
  });

  afterAll(() => {
    // 清理测试数据
    const testFiles = [
      'data/test-token.json',
      'data/test-analysis.json',
      'data/comment-history.json',
      'data/post-history.json',
    ];
    for (const file of testFiles) {
      const filePath = path.resolve(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  it('应完成签到流程', async () => {
    const result = await signinService.performSignin();
    expect(result.success).toBe(true);
    expect(result.points).toBeGreaterThan(0);
    expect(result.attempts).toBe(1);
  });

  it('应完成内容分析流程', async () => {
    const summary = await analysisService.analyze();
    expect(summary.topics.length).toBeGreaterThan(0);
    expect(summary.styleDescription.length).toBeGreaterThan(0);
    expect(summary.exampleTexts.length).toBeGreaterThan(0);
    expect(summary.updatedAt).toBeDefined();
  });

  it('应完成自动评论流程', async () => {
    // 先执行分析以生成缓存
    await analysisService.analyze();

    const results = await commentService.performDailyComments();
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(2); // dailyLimit = 2
    expect(results[0].success).toBe(true);
    expect(results[0].commentId).toBeDefined();
  });

  it('应完成自动发帖流程', async () => {
    await analysisService.analyze();

    const results = await postService.performDailyPosts();
    expect(results.length).toBe(1); // dailyLimit = 1
    expect(results[0].success).toBe(true);
    expect(results[0].postId).toBeDefined();
    expect(results[0].title).toBeDefined();
  });

  it('应生成每日摘要', async () => {
    const signinResult = await signinService.performSignin();
    await analysisService.analyze();
    const commentResults = await commentService.performDailyComments();
    const postResults = await postService.performDailyPosts();

    const summary = generateDailySummary(signinResult, commentResults, postResults);
    expect(summary.date).toBeDefined();
    expect(summary.signin.success).toBe(true);
    expect(summary.comments.successful).toBeGreaterThan(0);
    expect(summary.posts.successful).toBe(1);
    expect(summary.failedTasks).toEqual([]);
  });
});
