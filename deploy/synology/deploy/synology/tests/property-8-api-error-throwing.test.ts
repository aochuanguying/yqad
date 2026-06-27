/**
 * Property 8: API client error throwing on non-zero code
 *
 * For any upstream response with non-zero code and arbitrary message,
 * getMemberInfo() SHALL throw an Error containing both the code and the message.
 *
 * **Validates: Requirements 6.4**
 */
import fc from 'fast-check';
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

describe('Feature: member-info-and-token-verification, Property 8: API client error throwing on non-zero code', () => {
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

  it('getMemberInfo throws Error containing both code and message for any non-zero code', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-zero integer codes (exclude 0)
        fc.integer({ min: 1, max: 99999 }),
        // Generate arbitrary message strings
        fc.string({ minLength: 0, maxLength: 200 }),
        async (code, message) => {
          mockAxiosInstance.get.mockResolvedValue({
            data: { code, message },
            headers: {},
          });

          let thrownError: Error | null = null;
          try {
            await api.getMemberInfo('test-token');
          } catch (e) {
            thrownError = e as Error;
          }

          // Must throw
          expect(thrownError).not.toBeNull();
          expect(thrownError).toBeInstanceOf(Error);

          // Error message must contain the code
          expect(thrownError!.message).toContain(String(code));

          // Error message must contain the upstream message (when non-empty)
          if (message.length > 0) {
            expect(thrownError!.message).toContain(message);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('getMemberInfo throws Error containing code for negative non-zero codes', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate negative codes as well
        fc.integer({ min: -99999, max: -1 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (code, message) => {
          mockAxiosInstance.get.mockResolvedValue({
            data: { code, message },
            headers: {},
          });

          let thrownError: Error | null = null;
          try {
            await api.getMemberInfo('test-token');
          } catch (e) {
            thrownError = e as Error;
          }

          expect(thrownError).not.toBeNull();
          expect(thrownError).toBeInstanceOf(Error);
          expect(thrownError!.message).toContain(String(code));
          expect(thrownError!.message).toContain(message);
        },
      ),
      { numRuns: 100 },
    );
  });
});
