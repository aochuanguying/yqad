/**
 * Token 续期逻辑单元测试
 */
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

describe('Token 续期逻辑', () => {
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

  describe('checkTokenRenewal via getPosts', () => {
    it('响应头包含新 Token 时触发回调', async () => {
      const newToken = 'eyJhbGciOiJIUzI1NiJ9.new_token_payload.sig';
      const renewalCallback = jest.fn();
      api.setTokenRenewalCallback(renewalCallback);

      mockAxiosInstance.get.mockResolvedValue({
        data: { code: 0, data: { records: [] } },
        headers: { 'x-access-token': newToken },
      });

      await api.getPosts('old-token', 1, 10);

      expect(renewalCallback).toHaveBeenCalledWith(newToken);
    });

    it('响应头 Token 与当前 Token 相同时不触发回调', async () => {
      const sameToken = 'eyJhbGciOiJIUzI1NiJ9.same_payload.sig';
      const renewalCallback = jest.fn();
      api.setTokenRenewalCallback(renewalCallback);

      mockAxiosInstance.get.mockResolvedValue({
        data: { code: 0, data: { records: [] } },
        headers: { 'x-access-token': sameToken },
      });

      await api.getPosts(sameToken, 1, 10);

      expect(renewalCallback).not.toHaveBeenCalled();
    });

    it('响应头无 x-access-token 时不触发回调', async () => {
      const renewalCallback = jest.fn();
      api.setTokenRenewalCallback(renewalCallback);

      mockAxiosInstance.get.mockResolvedValue({
        data: { code: 0, data: { records: [] } },
        headers: {},
      });

      await api.getPosts('token', 1, 10);

      expect(renewalCallback).not.toHaveBeenCalled();
    });

    it('响应头 Token 不以 eyJ 开头时不触发回调', async () => {
      const renewalCallback = jest.fn();
      api.setTokenRenewalCallback(renewalCallback);

      mockAxiosInstance.get.mockResolvedValue({
        data: { code: 0, data: { records: [] } },
        headers: { 'x-access-token': 'invalid-token-format' },
      });

      await api.getPosts('eyJ_old_token', 1, 10);

      expect(renewalCallback).not.toHaveBeenCalled();
    });
  });

  describe('checkTokenRenewal via publishComment', () => {
    it('评论接口也能触发 Token 续期', async () => {
      const newToken = 'eyJhbGciOiJIUzI1NiJ9.renewed.sig';
      const renewalCallback = jest.fn();
      api.setTokenRenewalCallback(renewalCallback);

      mockAxiosInstance.post.mockResolvedValue({
        data: { code: 0, data: true },
        headers: { 'x-access-token': newToken },
      });

      await api.publishComment('eyJ_old', 'post-1', '评论', 'INFORMATION');

      expect(renewalCallback).toHaveBeenCalledWith(newToken);
    });
  });

  describe('未设置回调时不报错', () => {
    it('无回调时正常工作', async () => {
      // 不调用 setTokenRenewalCallback
      mockAxiosInstance.get.mockResolvedValue({
        data: { code: 0, data: { records: [] } },
        headers: { 'x-access-token': 'eyJ_new_token' },
      });

      // 不应抛错
      await expect(api.getPosts('eyJ_old', 1, 10)).resolves.toBeDefined();
    });
  });
});
