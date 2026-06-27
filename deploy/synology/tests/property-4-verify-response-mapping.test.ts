/**
 * Property 4: Successful verify response mapping
 *
 * For any successful getMemberInfo call returning an arbitrary memberLevel string,
 * the verify endpoint SHALL return `{ remoteValid: true, memberLevel: <that string> }`.
 *
 * **Validates: Requirements 3.2**
 */
import fc from 'fast-check';
import express from 'express';
import request from 'supertest';

// Mock config
jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: { mode: 'real', baseUrl: 'https://audi2c.faw-vw.com', timeout: 10000 },
    auth: { username: 'test', password: 'test', tokenStorePath: './data/test-property4-token.json' },
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

// Mock fs to simulate a valid token
const validToken = {
  accessToken: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test-token',
  refreshToken: '',
  expiresAt: Date.now() + 86400000 * 3, // 3 days from now — well within validity
  savedAt: Date.now(),
};

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn((p: string) => {
      if (p.includes('test-property4-token.json')) return true;
      return actual.existsSync(p);
    }),
    readFileSync: jest.fn((p: string, ...args: any[]) => {
      if (p.includes('test-property4-token.json')) return JSON.stringify(validToken);
      return actual.readFileSync(p, ...args);
    }),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
  };
});

// Mock axios to control getMemberInfo responses
jest.mock('axios', () => {
  const mockInstance = {
    get: jest.fn(),
    post: jest.fn(),
  };
  const mockAxios: any = {
    create: jest.fn(() => mockInstance),
    isAxiosError: jest.fn(() => false),
    __mockInstance: mockInstance,
  };
  return {
    __esModule: true,
    default: mockAxios,
    ...mockAxios,
  };
});

import axios from 'axios';
import authRoutes from '../src/web/routes/auth-routes';

const mockAxios = axios as any;

describe('Feature: member-info-and-token-verification, Property 4: Successful verify response mapping', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    jest.clearAllMocks();

    // Re-setup mock for each test since clearAllMocks resets them
    mockAxios.create.mockReturnValue(mockAxios.__mockInstance);
    mockAxios.isAxiosError.mockReturnValue(false);
  });

  it('verify returns { remoteValid: true, memberLevel } for any successful getMemberInfo response', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary memberLevel strings (non-empty to be realistic)
        fc.string({ minLength: 1, maxLength: 100 }),
        async (memberLevel) => {
          // Mock getMemberInfo to return success with the generated memberLevel
          mockAxios.__mockInstance.get.mockResolvedValue({
            data: {
              code: 0,
              data: {
                memberLevel,
                memberScore: '100',
                growthScore: '200',
              },
            },
            headers: {},
          });

          const response = await request(app)
            .post('/api/auth/verify')
            .send();

          // The verify endpoint SHALL return remoteValid: true and the exact memberLevel
          expect(response.status).toBe(200);
          expect(response.body.code).toBe(0);
          expect(response.body.data.remoteValid).toBe(true);
          expect(response.body.data.memberLevel).toBe(memberLevel);
        },
      ),
      { numRuns: 100 },
    );
  });
});
