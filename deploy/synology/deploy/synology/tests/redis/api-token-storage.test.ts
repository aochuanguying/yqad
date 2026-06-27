/**
 * API Token 存储测试
 */

import { apiTokenStorage } from '../../src/storage/redis/api-token-storage';

describe('ApiTokenStorage', () => {
  const testToken = 'test-api-token-12345';

  beforeAll(async () => {
    const { initializeRedisStorage } = await import('../../src/storage/redis/init');
    try {
      await initializeRedisStorage();
    } catch (error) {
      console.warn('Redis 不可用，将使用降级模式');
    }
  });

  beforeEach(async () => {
    await apiTokenStorage.deleteToken();
  });

  describe('saveToken() / getToken()', () => {
    it('应该保存和获取 Token', async () => {
      await apiTokenStorage.saveToken(testToken);
      const token = await apiTokenStorage.getToken();
      expect(token).toBe(testToken);
    });

    it('应该返回 null 如果 Token 不存在', async () => {
      const token = await apiTokenStorage.getToken();
      expect(token).toBeNull();
    });
  });

  describe('hasToken()', () => {
    it('应该检查 Token 是否存在', async () => {
      await apiTokenStorage.saveToken(testToken);
      const hasToken = await apiTokenStorage.hasToken();
      expect(hasToken).toBe(true);
    });

    it('应该返回 false 如果 Token 不存在', async () => {
      const hasToken = await apiTokenStorage.hasToken();
      expect(hasToken).toBe(false);
    });
  });

  describe('deleteToken()', () => {
    it('应该删除 Token', async () => {
      await apiTokenStorage.saveToken(testToken);
      await apiTokenStorage.deleteToken();
      const token = await apiTokenStorage.getToken();
      expect(token).toBeNull();
    });
  });

  describe('加密功能', () => {
    it('应该自动加密 Token', async () => {
      await apiTokenStorage.saveToken(testToken);
      
      // 直接从 Redis 获取的应该是加密的
      const { getRedisClient, formatKey } = await import('../../src/utils/redis-connection-manager');
      const client = getRedisClient();
      const key = formatKey('api:token');
      const encryptedToken = await client.get(key);
      
      expect(encryptedToken).not.toBe(testToken);
      expect(encryptedToken).toMatch(/^U2FsdGVk/); // AES 加密前缀
    });

    it('应该自动解密 Token', async () => {
      await apiTokenStorage.saveToken(testToken);
      const token = await apiTokenStorage.getToken();
      expect(token).toBe(testToken);
    });
  });

  describe('降级策略', () => {
    it('应该在 Redis 不可用时降级到内存存储', async () => {
      apiTokenStorage['useRedis'] = false;
      
      await apiTokenStorage.saveToken(testToken);
      const token = await apiTokenStorage.getToken();
      expect(token).toBe(testToken);
      
      apiTokenStorage.resetToRedis();
    });
  });
});
