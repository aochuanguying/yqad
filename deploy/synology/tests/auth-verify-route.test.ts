import express from 'express';
import request from 'supertest';
import axios from 'axios';

// Mock config
jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'real', baseUrl: 'https://audi2c.faw-vw.com', timeout: 10000 },
    auth: { username: 'test', password: 'test', tokenStorePath: './data/test-verify-token.json' },
    logging: { level: 'error', dir: './logs', retainDays: 30 },
  }),
  resetConfigCache: () => {},
}));

// Mock fs to control token existence
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn((p: string) => {
      if (p.includes('test-verify-token.json')) return false;
      return actual.existsSync(p);
    }),
    readFileSync: jest.fn((p: string, ...args: any[]) => {
      if (p.includes('test-verify-token.json')) return '{}';
      return actual.readFileSync(p, ...args);
    }),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
  };
});

// We need to test the route directly, so let's import after mocks
import authRoutes from '../src/web/routes/auth-routes';

describe('POST /api/auth/verify', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    // Reset module state
    jest.clearAllMocks();
  });

  it('returns 401 when no valid token is available', async () => {
    const response = await request(app)
      .post('/api/auth/verify')
      .send();

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      code: 401,
      message: '无可用Token进行验证',
    });
  });
});
