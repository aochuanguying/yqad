/**
 * 任务 7.1: 搜索词选择器单元测试
 * 
 * 测试覆盖：
 * - 小红书搜索词选择逻辑（小时级切换）
 * - 知乎搜索词选择逻辑（专业术语优先）
 * - 汽车之家搜索词选择逻辑（短词优先）
 */

import { PlatformAwareKeywordSelector } from '../services/internet-search/search-manager';

describe('PlatformAwareKeywordSelector', () => {
  let selector: PlatformAwareKeywordSelector;

  beforeEach(() => {
    selector = new PlatformAwareKeywordSelector();
  });

  describe('小红书搜索词选择', () => {
    test('应该根据小时数轮询选择搜索词', () => {
      const keywords = ['奥迪 Q5L', '奥迪 A4L', '奥迪自驾游', '奥迪露营'];
      
      // 模拟不同小时的选择
      const hour = Math.floor(Date.now() / 3600000);
      const expectedIndex = hour % keywords.length;
      const expected = keywords[expectedIndex];
      
      const result = selector.select(keywords, 'xiaohongshu');
      
      expect(result).toBe(expected);
      expect(keywords).toContain(result);
    });

    test('空关键词数组应该返回空字符串', () => {
      const result = selector.select([], 'xiaohongshu');
      expect(result).toBe('');
    });

    test('单个关键词应该始终返回该词', () => {
      const keywords = ['奥迪 Q5L'];
      
      for (let i = 0; i < 5; i++) {
        const result = selector.select(keywords, 'xiaohongshu');
        expect(result).toBe('奥迪 Q5L');
      }
    });
  });

  describe('知乎搜索词选择', () => {
    test('应该优先选择专业问句', () => {
      const keywords = ['奥迪 Q5L', '如何评价奥迪 Q5L', '奥迪 Q5L 值得购买吗', '奥迪 Q5L vs 宝马 X3'];
      
      const result = selector.select(keywords, 'zhihu');
      
      // 应该选择专业问句
      expect(result).toMatch(/(如何 | 评价 | 值得 | vs)/);
    });

    test('没有专业问句时选择最长的关键词', () => {
      const keywords = ['奥迪', '奥迪 Q5L', '奥迪 A4L', '奥迪 A6L'];
      
      const result = selector.select(keywords, 'zhihu');
      
      // 应该选择最长的词（长度相同则选择第一个）
      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    test('空关键词数组应该返回空字符串', () => {
      const result = selector.select([], 'zhihu');
      expect(result).toBe('');
    });
  });

  describe('汽车之家搜索词选择', () => {
    test('应该优先选择短词（2-4 字）', () => {
      const keywords = ['奥迪 Q5L 怎么样', '提车', '奥迪 Q5L 油耗', '改装', '奥迪自驾游'];
      
      const result = selector.select(keywords, 'autohome');
      
      // 应该选择短词
      expect(result.length).toBeLessThanOrEqual(4);
      expect(['提车', '改装'].includes(result)).toBe(true);
    });

    test('没有短词时选择第一个词', () => {
      const keywords = ['奥迪 Q5L 怎么样', '奥迪 Q5L 油耗', '奥迪自驾游'];
      
      const result = selector.select(keywords, 'autohome');
      
      expect(result).toBe('奥迪 Q5L 怎么样');
    });

    test('空关键词数组应该返回空字符串', () => {
      const result = selector.select([], 'autohome');
      expect(result).toBe('');
    });
  });

  describe('未知平台处理', () => {
    test('未知平台应该返回第一个关键词', () => {
      const keywords = ['奥迪 Q5L', '奥迪 A4L', '奥迪 A6L'];
      
      const result = selector.select(keywords, 'unknown_platform');
      
      expect(result).toBe('奥迪 Q5L');
    });
  });
});
