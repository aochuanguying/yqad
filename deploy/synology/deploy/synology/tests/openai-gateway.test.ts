import express from 'express';
import request from 'supertest';
import axios from 'axios';
import openaiGatewayRoutes from '../src/web/routes/openai-gateway-routes';

jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'mock', baseUrl: '', timeout: 10000 },
    auth: { username: 'test', password: 'test', tokenStorePath: './data/token.json' },
    ai: { apiKey: 'test-key', baseUrl: 'http://localhost/v1', model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
    openaiGateway: {
      enabled: true,
      port: 3000,
      apiKey: 'gw-test',
      upstream: {
        baseUrl: 'https://inner-apisix.hisense.com/higpt-new/v1',
        apiKey: 'up-test',
        userKey: 'uk-test',
        proxyUrl: '',
        timeoutMs: 1234,
      },
      modelAliases: { higpt: 'qwen3-5-397b' },
    },
    signin: { enabled: true, maxRetries: 3 },
    comment: { enabled: true, dailyLimit: 3, delayMin: 0, delayMax: 0 },
    post: { enabled: true, dailyLimit: 1, avoidRepeatDays: 7 },
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

jest.mock('axios');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/v1', openaiGatewayRoutes);
  return app;
}

describe('OpenAI 网关', () => {
  beforeEach(() => {
    (axios.post as any).mockReset();
  });

  it('缺少 Authorization 应返回 401（OpenAI 风格）', async () => {
    const app = createApp();
    const res = await request(app).get('/v1/models');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error.type', 'authentication_error');
  });

  it('token 不匹配应返回 401', async () => {
    const app = createApp();
    const res = await request(app).get('/v1/models').set('Authorization', 'Bearer wrong');
    expect(res.status).toBe(401);
  });

  it('GET /v1/models 返回 data[].id', async () => {
    const app = createApp();
    const res = await request(app).get('/v1/models').set('Authorization', 'Bearer gw-test');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('id');
  });

  it('POST /v1/chat/completions 应注入 user_key 且做 model 别名映射', async () => {
    (axios.post as any).mockResolvedValue({
      status: 200,
      data: { id: 'cmpl-test', choices: [{ message: { role: 'assistant', content: 'ok' } }] },
    });

    const app = createApp();
    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer gw-test')
      .send({ model: 'higpt', messages: [{ role: 'user', content: 'hi' }] });

    expect(res.status).toBe(200);
    expect((axios.post as any).mock.calls.length).toBe(1);
    const [url, body, cfg] = (axios.post as any).mock.calls[0];
    expect(String(url)).toContain('user_key=');
    expect(body.model).toBe('qwen3-5-397b');
    expect(cfg.timeout).toBe(1234);
  });

  it('上游 401/403 应映射为 502', async () => {
    (axios.post as any).mockResolvedValue({ status: 401, data: { error: 'no' } });
    const app = createApp();
    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer gw-test')
      .send({ model: 'qwen3-5-397b', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error.type', 'upstream_error');
  });

  it('上游超时应映射为 504', async () => {
    const err = Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });
    (axios.post as any).mockRejectedValue(err);

    const app = createApp();
    const res = await request(app)
      .post('/v1/chat/completions')
      .set('Authorization', 'Bearer gw-test')
      .send({ model: 'qwen3-5-397b', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(504);
    expect(res.body).toHaveProperty('error.type', 'upstream_timeout');
  });
});

