/**
 * Property 5: Unexpected error code pass-through in verify
 *
 * For any code not in {0, 401, 10009} and arbitrary message, verify SHALL return
 * `{ remoteValid: false }` with both code and message.
 *
 * **Validates: Requirements 3.6**
 */
import * as fc from 'fast-check';
import express from 'express';
import request from 'supertest';

// Mock the getMemberInfo function
const mockGetMemberInfo = jest.fn();

// Mock config
jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'real', baseUrl: 'https://audi2c.faw-vw.com', timeout: 10000, deviceId: 'TEST', nickName: '测试', ipRegion: '北京' },
    auth: { username: '', password: '', tokenStorePath: './data/test-property5-token.json' },
    logging: { level: 'error', dir: './logs', retainDays: 30 },
  }),
  resetConfigCache: () => {},
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock AuthService to control token status and access token
jest.mock('../src/services/auth', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    getTokenStatus: () => ({ valid: true, expiresAt: Date.now() + 86400000, remainingHours: 24 }),
    getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
  })),
}));

// Mock the RealAudiApi as an instance that passes instanceof check
jest.mock('../src/api/real-client', () => {
  class MockRealAudiApi {
    getMemberInfo = mockGetMemberInfo;
    setTokenRenewalCallback = jest.fn();
  }
  return {
    RealAudiApi: MockRealAudiApi,
  };
});

jest.mock('../src/api', () => {
  const { RealAudiApi } = require('../src/api/real-client');
  return {
    createApiClient: () => new RealAudiApi(),
  };
});

import authRoutes from '../src/web/routes/auth-routes';

describe('Feature: member-info-and-token-verification, Property 5: Unexpected error code pass-through in verify', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  it('for any code not in {0, 401, 10009} and arbitrary message, verify returns remoteValid=false with code and message', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random error codes, excluding 0, 401, 10009
        fc.integer({ min: 1, max: 99999 }).filter(code => code !== 0 && code !== 401 && code !== 10009),
        // Generate random message strings
        fc.string({ minLength: 0, maxLength: 100 }),
        async (errorCode, errorMessage) => {
          // Mock getMemberInfo to throw with the expected error format from RealAudiApi
          mockGetMemberInfo.mockRejectedValue(
            new Error(`获取会员信息失败: code=${errorCode} ${errorMessage}`)
          );

          const response = await request(app)
            .post('/api/auth/verify')
            .send();

          // Verify response structure
          expect(response.status).toBe(200);
          expect(response.body.code).toBe(0);
          expect(response.body.data.remoteValid).toBe(false);
          // Verify the message contains both code and original message
          expect(response.body.data.message).toBe(`未知错误 code=${errorCode}: ${errorMessage}`);
        },
      ),
      { numRuns: 100 },
    );
  });
});
