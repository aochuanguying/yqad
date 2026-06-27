import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/web/middleware/error-handler';
import configRoutes from '../src/web/routes/config-routes';
import { jsonBodyParser } from '../src/web/middleware/json-body-parser';

// Mock config
jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'mock', baseUrl: 'https://app-api.audi.faw.cn', timeout: 10000 },
    auth: { username: '', password: '', tokenStorePath: './data/token.json' },
    ai: { apiKey: 'sk-test', baseUrl: 'http://localhost/v1', model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
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
    comment: { enabled: true, dailyLimit: 3, delayMin: 30, delayMax: 120 },
    post: { enabled: true, dailyLimit: 1, avoidRepeatDays: 7 },
    analysis: { postCount: 20, cacheHours: 24, storagePath: './data/analysis.json' },
    scheduler: {
      signin: { cron: '0 8 * * *', randomOffsetMin: 0, randomOffsetMax: 60 },
      comment: { cron: '0 10 * * *', randomOffsetMin: 0, randomOffsetMax: 600 },
      post: { cron: '0 12 * * *', randomOffsetMin: 0, randomOffsetMax: 360 },
    },
    logging: { level: 'info', dir: './logs', retainDays: 30 },
    web: { enabled: true, port: 3000 },
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

// Mock config-events
jest.mock('../src/web/services/config-events', () => ({
  configEvents: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

function createApp() {
  const app = express();
  app.use(jsonBodyParser());
  app.use('/api', configRoutes);
  app.use(errorHandler);
  return app;
}

describe('配置 API 路由', () => {
  describe('GET /api/config', () => {
    it('应返回全部配置', async () => {
      const app = createApp();
      const res = await request(app).get('/api/config');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('api');
      expect(res.body).toHaveProperty('scheduler');
      expect(res.body).toHaveProperty('ai');
    });
  });

  describe('GET /api/config/:group', () => {
    it('应返回指定分组', async () => {
      const app = createApp();
      const res = await request(app).get('/api/config/ai');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('model');
      expect(res.body).toHaveProperty('apiKey');
    });

    it('应对不存在的分组返回 404', async () => {
      const app = createApp();
      const res = await request(app).get('/api/config/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/config/:group', () => {
    it('应拒绝无效配置（验证失败）', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/config/api')
        .send({ mode: 'invalid', baseUrl: 'http://test.com', timeout: 10000 });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('应拒绝空请求体', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/config/api')
        .send('');
      expect(res.status).toBe(400);
    });

    it('应接受超过 Express 默认大小的大请求体并交给业务校验', async () => {
      const app = createApp();
      const res = await request(app)
        .put('/api/config/nonexistent')
        .send({ extra: 'x'.repeat(150 * 1024) });
      expect(res.status).not.toBe(413);
      expect(res.body.error || '').not.toMatch(/request entity too large/i);
    });
  });
});
