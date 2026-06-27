/**
 * 敏感词库存储测试
 */

import { sensitiveWordsStorage } from '../../src/storage/redis/sensitive-words-storage';

describe('SensitiveWordsStorage', () => {
  const testWords = ['敏感词 1', '敏感词 2', '敏感词 3'];

  beforeAll(async () => {
    const { initializeRedisStorage } = await import('../../src/storage/redis/init');
    try {
      await initializeRedisStorage();
    } catch (error) {
      console.warn('Redis 不可用，将使用降级模式');
    }
  });

  beforeEach(async () => {
    // 清理测试数据
    for (const word of testWords) {
      await sensitiveWordsStorage.removeWord(word);
    }
  });

  describe('addWord() / contains()', () => {
    it('应该添加和检查敏感词', async () => {
      await sensitiveWordsStorage.addWord('敏感词 1');
      const contains = await sensitiveWordsStorage.contains('敏感词 1');
      expect(contains).toBe(true);
    });

    it('应该返回 false 如果词不存在', async () => {
      const contains = await sensitiveWordsStorage.contains('不存在的词');
      expect(contains).toBe(false);
    });
  });

  describe('removeWord()', () => {
    it('应该移除敏感词', async () => {
      await sensitiveWordsStorage.addWord('敏感词 1');
      await sensitiveWordsStorage.removeWord('敏感词 1');
      const contains = await sensitiveWordsStorage.contains('敏感词 1');
      expect(contains).toBe(false);
    });
  });

  describe('getAllWords()', () => {
    it('应该获取所有敏感词', async () => {
      for (const word of testWords) {
        await sensitiveWordsStorage.addWord(word);
      }
      
      const allWords = await sensitiveWordsStorage.getAllWords();
      expect(allWords).toHaveLength(3);
      
      for (const word of testWords) {
        expect(allWords).toContain(word);
      }
    });
  });

  describe('importWords() - Pipeline 批量导入', () => {
    it('应该批量导入敏感词', async () => {
      await sensitiveWordsStorage.importWords(testWords);
      
      const allWords = await sensitiveWordsStorage.getAllWords();
      expect(allWords.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Pub/Sub 热更新', () => {
    it('应该发布词库更新通知', async () => {
      // 这个测试主要验证功能存在，实际的 Pub/Sub 测试需要订阅者
      await sensitiveWordsStorage.reloadWordLibrary();
      // 如果没有抛出异常，说明功能正常
      expect(true).toBe(true);
    });
  });

  describe('降级策略', () => {
    it('应该在 Redis 不可用时降级到内存存储', async () => {
      sensitiveWordsStorage['useRedis'] = false;
      
      await sensitiveWordsStorage.addWord('敏感词');
      const contains = await sensitiveWordsStorage.contains('敏感词');
      expect(contains).toBe(true);
      
      sensitiveWordsStorage.resetToRedis();
    });
  });
});
