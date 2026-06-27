import { createScheduler, Scheduler } from '../src/scheduler';
import { configEvents } from '../src/web/services/config-events';

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    stop: jest.fn(),
  })),
}));

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
    analysis: { postCount: 5, cacheHours: 24, storagePath: './data/analysis.json' },
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
  resetConfigCache: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../src/utils/retry', () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
  randomDelay: jest.fn().mockReturnValue(0),
}));

describe('调度器热重载', () => {
  let scheduler: Scheduler;
  const mockHandler = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new Scheduler();
    scheduler.registerTask('每日签到', '0 8 * * *', 0, 60, mockHandler);
    scheduler.registerTask('自动评论', '0 10 * * *', 0, 600, mockHandler);
    scheduler.registerTask('自动发帖', '0 12 * * *', 0, 360, mockHandler);
    scheduler.registerTask('素材梳理', '0 7 * * *', 0, 30, mockHandler);
  });

  afterEach(() => {
    scheduler.stop();
    configEvents.removeAllListeners();
  });

  it('启动后应订阅配置变更事件', () => {
    scheduler.start();
    expect(configEvents.listenerCount('configChanged')).toBe(1);
  });

  it('停止后应取消事件订阅', () => {
    scheduler.start();
    scheduler.stop();
    expect(configEvents.listenerCount('configChanged')).toBe(0);
  });

  it('收到 scheduler 配置变更时应重新调度', () => {
    const cron = require('node-cron');
    scheduler.start();

    // 清除启动时的调用计数
    const initialCallCount = cron.schedule.mock.calls.length;

    // 发出配置变更事件
    configEvents.emit('configChanged', {
      group: 'scheduler',
      oldConfig: {},
      newConfig: {
        signin: { cron: '0 9 * * *', randomOffsetMin: 0, randomOffsetMax: 30 },
        comment: { cron: '0 11 * * *', randomOffsetMin: 0, randomOffsetMax: 300 },
        post: { cron: '0 14 * * *', randomOffsetMin: 0, randomOffsetMax: 180 },
        materialProcessing: { cron: '0 6 * * *', randomOffsetMin: 0, randomOffsetMax: 10 },
      },
    });

    // 应该重新创建 4 个 cron 任务
    expect(cron.schedule.mock.calls.length).toBe(initialCallCount + 4);
  });

  it('createScheduler 应只注册非内容分析任务', () => {
    const cron = require('node-cron');
    const created = createScheduler({
      signin: mockHandler,
      comment: mockHandler,
      post: mockHandler,
      materialProcessing: mockHandler,
    });

    const tasks = (created as any).tasks.map((task: any) => task.name);
    expect(tasks).toEqual(['每日签到', '自动评论', '自动发帖', '素材梳理']);
    expect(tasks).not.toContain('内容分析');

    created.start();
    expect(cron.schedule).toHaveBeenCalledTimes(4);
    created.stop();
  });

  it('非 scheduler 配置变更不应触发重新调度', () => {
    const cron = require('node-cron');
    scheduler.start();
    const callCount = cron.schedule.mock.calls.length;

    configEvents.emit('configChanged', {
      group: 'ai',
      oldConfig: {},
      newConfig: { apiKey: 'new-key' },
    });

    // 调用次数不变
    expect(cron.schedule.mock.calls.length).toBe(callCount);
  });
});
