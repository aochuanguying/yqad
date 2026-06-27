/**
 * Property 2: Upstream error code maps to 502 with message
 *
 * For any non-zero code and arbitrary message string, the route SHALL return
 * HTTP 502 with the upstream message included.
 *
 * **Validates: Requirements 1.4**
 */
import fc from 'fast-check';
import express from 'express';
import request from 'supertest';
import type { Server } from 'http';

// Mock config before any imports that use it
jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'real', baseUrl: 'https://audi2c.faw-vw.com', timeout: 10000, deviceId: 'TEST', nickName: '测试', ipRegion: '北京' },
    auth: { username: '', password: '', tokenStorePath: './data/token.json' },
    logging: { level: 'error', dir: './logs', retainDays: 30 },
  }),
  resetConfigCache: () => {},
}));

jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock the createApiClient and AuthService
const mockGetMemberInfo = jest.fn();
const mockGetTokenStatus = jest.fn();
const mockGetAccessToken = jest.fn();

// Create a fake RealAudiApi class so instanceof checks pass
class FakeRealAudiApi {
  getMemberInfo = mockGetMemberInfo;
}

jest.mock('../src/api/real-client', () => ({
  RealAudiApi: FakeRealAudiApi,
}));

jest.mock('../src/api', () => ({
  createApiClient: () => new FakeRealAudiApi(),
}));

jest.mock('../src/services/auth', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    getTokenStatus: mockGetTokenStatus,
    getAccessToken: mockGetAccessToken,
  })),
}));

import memberRoutes from '../src/web/routes/member-routes';

describe('Feature: member-info-and-token-verification, Property 2: Upstream error code maps to 502 with message', () => {
  let app: express.Application;
  let server: Server;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/member', memberRoutes);
    server = app.listen(0);

    // Token is valid so the route proceeds to call getMemberInfo
    mockGetTokenStatus.mockReturnValue({ valid: true, expiresAt: Date.now() + 3600000, remainingHours: 10 });
    mockGetAccessToken.mockResolvedValue('test-access-token');
    jest.clearAllMocks();
    // Re-setup after clearAllMocks
    mockGetTokenStatus.mockReturnValue({ valid: true, expiresAt: Date.now() + 3600000, remainingHours: 10 });
    mockGetAccessToken.mockResolvedValue('test-access-token');
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('returns HTTP 502 with upstream message for any non-zero error code and message', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-zero codes (positive and negative)
        fc.integer({ min: 1, max: 99999 }),
        // Generate arbitrary message strings (non-empty to verify inclusion)
        fc.string({ minLength: 1, maxLength: 200 }),
        async (code, message) => {
          // getMemberInfo throws an error with format: "获取会员信息失败: code=<N> <message>"
          const errorMessage = `获取会员信息失败: code=${code} ${message}`;
          mockGetMemberInfo.mockRejectedValue(new Error(errorMessage));

          const response = await request(server)
            .get('/api/member/info')
            .expect(502);

          // Response must have an error field
          expect(response.body).toHaveProperty('error');
          // The error field must include the upstream error message
          expect(response.body.error).toContain(errorMessage);
          // Specifically, it should be in the format "上游服务错误: <error.message>"
          expect(response.body.error).toBe(`上游服务错误: ${errorMessage}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns HTTP 502 with upstream message for negative non-zero codes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -99999, max: -1 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (code, message) => {
          const errorMessage = `获取会员信息失败: code=${code} ${message}`;
          mockGetMemberInfo.mockRejectedValue(new Error(errorMessage));

          const response = await request(server)
            .get('/api/member/info')
            .expect(502);

          expect(response.body.error).toBe(`上游服务错误: ${errorMessage}`);
        },
      ),
      { numRuns: 100 },
    );
  });
});
