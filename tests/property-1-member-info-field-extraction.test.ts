/**
 * Property 1: Member info response field extraction
 *
 * For any valid upstream response with arbitrary memberLevel, memberScore,
 * growthScore strings, the route SHALL return those exact values unchanged.
 *
 * **Validates: Requirements 1.2**
 */
import fc from 'fast-check';
import express from 'express';
import request from 'supertest';

// Create mock functions that we'll control per-test
const mockGetMemberInfo = jest.fn();
const mockGetTokenStatus = jest.fn();
const mockGetAccessToken = jest.fn();

// Mock config
jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'real', baseUrl: 'https://audi2c.faw-vw.com', timeout: 10000, deviceId: 'TEST', nickName: '测试', ipRegion: '北京' },
    auth: { username: 'test', password: 'test', tokenStorePath: './data/test-property1-token.json' },
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

// Mock fs to prevent actual file system operations
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn((p: string) => {
      if (p.includes('test-property1-token.json')) return false;
      return actual.existsSync(p);
    }),
    readFileSync: jest.fn((p: string, ...args: any[]) => {
      if (p.includes('test-property1-token.json')) return '{}';
      return actual.readFileSync(p, ...args);
    }),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
  };
});

// Define a mock RealAudiApi class - this is the reference used by instanceof check
class FakeRealAudiApi {
  getMemberInfo = mockGetMemberInfo;
  setTokenRenewalCallback = jest.fn();
  login = jest.fn();
  refreshToken = jest.fn();
}

jest.mock('../src/api/real-client', () => ({
  RealAudiApi: FakeRealAudiApi,
}));

// createApiClient returns an instance of FakeRealAudiApi so instanceof check passes
jest.mock('../src/api', () => ({
  createApiClient: () => new FakeRealAudiApi(),
}));

// Mock AuthService so it uses our controlled mock functions
jest.mock('../src/services/auth', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    getTokenStatus: mockGetTokenStatus,
    getAccessToken: mockGetAccessToken,
  })),
  computeTokenStatus: jest.fn(),
}));

import memberRoutes from '../src/web/routes/member-routes';

describe('Feature: member-info-and-token-verification, Property 1: Member info response field extraction', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/member', memberRoutes);
    jest.clearAllMocks();

    // Default: token is valid
    mockGetTokenStatus.mockReturnValue({ valid: true, expiresAt: Date.now() + 86400000, remainingHours: 24 });
    mockGetAccessToken.mockResolvedValue('fake-access-token');
  });

  it('returns arbitrary memberLevel, memberScore, growthScore unchanged from upstream', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 0, maxLength: 100 }),
        async (memberLevel, memberScore, growthScore) => {
          // Mock the upstream API to return the generated values
          mockGetMemberInfo.mockResolvedValue({
            memberLevel,
            memberScore,
            growthScore,
          });

          const response = await request(app)
            .get('/api/member/info')
            .expect(200);

          // The route SHALL return those exact values unchanged
          expect(response.body).toEqual({
            code: 0,
            data: {
              memberLevel,
              memberScore,
              growthScore,
            },
          });
        },
      ),
      { numRuns: 100 },
    );
  });
});
