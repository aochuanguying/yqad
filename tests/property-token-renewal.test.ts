/**
 * Property 7: Token renewal detection
 *
 * For any pair of (currentToken, responseHeaderToken) strings, the token renewal
 * callback SHALL be invoked if and only if responseHeaderToken is defined, differs
 * from currentToken, and starts with "eyJ".
 *
 * **Validates: Requirements 6.3**
 */
import * as fc from 'fast-check';
import axios from 'axios';
import { RealAudiApi } from '../src/api/real-client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../src/utils/config', () => ({
  loadConfig: () => ({
    api: {
      mode: 'real',
      baseUrl: 'https://audi2c.faw-vw.com',
      timeout: 10000,
      deviceId: 'TEST_DEVICE',
      nickName: '测试',
      ipRegion: '北京',
    },
    auth: { username: '', password: '', tokenStorePath: './data/token.json' },
  }),
}));

jest.mock('../src/utils/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Feature: member-info-and-token-verification, Property 7: Token renewal detection', () => {
  let api: RealAudiApi;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    api = new RealAudiApi();
  });

  it('callback is invoked iff responseHeaderToken is defined, differs from currentToken, and starts with "eyJ"', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate currentToken as an arbitrary string
        fc.string({ minLength: 0, maxLength: 50 }),
        // Generate responseHeaderToken as either undefined or an arbitrary string
        fc.option(fc.string({ minLength: 0, maxLength: 50 }), { nil: undefined }),
        async (currentToken, responseHeaderToken) => {
          // Reset mock instance for each iteration
          const renewalCallback = jest.fn();
          api.setTokenRenewalCallback(renewalCallback);

          // Build response headers
          const headers: Record<string, string> = {};
          if (responseHeaderToken !== undefined) {
            headers['x-access-token'] = responseHeaderToken;
          }

          // Mock getMemberInfo's underlying GET call to return success with our headers
          mockAxiosInstance.get.mockResolvedValue({
            data: {
              code: 0,
              data: {
                memberLevel: '普通会员',
                memberScore: '100',
                growthScore: '200',
              },
            },
            headers,
          });

          await api.getMemberInfo(currentToken);

          // Determine expected behavior based on the property
          const shouldInvoke =
            responseHeaderToken !== undefined &&
            responseHeaderToken !== currentToken &&
            responseHeaderToken.startsWith('eyJ');

          if (shouldInvoke) {
            expect(renewalCallback).toHaveBeenCalledTimes(1);
            expect(renewalCallback).toHaveBeenCalledWith(responseHeaderToken);
          } else {
            expect(renewalCallback).not.toHaveBeenCalled();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('callback is invoked for tokens starting with "eyJ" that differ from current', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a currentToken that does NOT start with "eyJ" to ensure difference
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.startsWith('eyJ')),
        // Generate a responseHeaderToken that always starts with "eyJ" + some suffix
        fc.string({ minLength: 1, maxLength: 47 }).map(s => 'eyJ' + s),
        async (currentToken, responseHeaderToken) => {
          const renewalCallback = jest.fn();
          api.setTokenRenewalCallback(renewalCallback);

          mockAxiosInstance.get.mockResolvedValue({
            data: {
              code: 0,
              data: {
                memberLevel: '金卡',
                memberScore: '500',
                growthScore: '1000',
              },
            },
            headers: { 'x-access-token': responseHeaderToken },
          });

          await api.getMemberInfo(currentToken);

          // Since responseHeaderToken starts with "eyJ" and differs from currentToken
          expect(renewalCallback).toHaveBeenCalledTimes(1);
          expect(renewalCallback).toHaveBeenCalledWith(responseHeaderToken);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('callback is NOT invoked when responseHeaderToken equals currentToken', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate any token string (can start with "eyJ" or not)
        fc.string({ minLength: 1, maxLength: 50 }),
        async (token) => {
          const renewalCallback = jest.fn();
          api.setTokenRenewalCallback(renewalCallback);

          mockAxiosInstance.get.mockResolvedValue({
            data: {
              code: 0,
              data: {
                memberLevel: '普通',
                memberScore: '0',
                growthScore: '0',
              },
            },
            headers: { 'x-access-token': token },
          });

          // Use same token as both current and header
          await api.getMemberInfo(token);

          expect(renewalCallback).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('callback is NOT invoked when responseHeaderToken does not start with "eyJ"', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate currentToken
        fc.string({ minLength: 0, maxLength: 50 }),
        // Generate responseHeaderToken that does NOT start with "eyJ"
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.startsWith('eyJ')),
        async (currentToken, responseHeaderToken) => {
          const renewalCallback = jest.fn();
          api.setTokenRenewalCallback(renewalCallback);

          mockAxiosInstance.get.mockResolvedValue({
            data: {
              code: 0,
              data: {
                memberLevel: '银卡',
                memberScore: '200',
                growthScore: '500',
              },
            },
            headers: { 'x-access-token': responseHeaderToken },
          });

          await api.getMemberInfo(currentToken);

          // Should never invoke because doesn't start with "eyJ"
          expect(renewalCallback).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
