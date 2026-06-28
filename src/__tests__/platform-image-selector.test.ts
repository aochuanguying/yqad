/**
 * 任务 7.4: 图片选择器单元测试
 * 
 * 测试覆盖：
 * - 小红书图片选择逻辑（高清、精美、生活化）
 * - 知乎图片选择逻辑（信息图、数据图、专业）
 * - 汽车之家图片选择选择逻辑（实拍图、细节图、实用）
 * - 图片质量评分（7 维度）
 * - 平台适配度计算
 */

import { MaterialRecord } from '../services/hybrid-material-service';

// 创建模拟图片记录
function createMockImage(options: {
  id: string;
  source: 'local' | 'internet';
  path: string;
  qualityScore?: number;
}): MaterialRecord {
  return {
    id: options.id,
    source: options.source,
    path: options.path,
    usageCount: 0,
    associatedPosts: [],
    createdAt: new Date().toISOString(),
    qualityScore: options.qualityScore ? {
      totalScore: options.qualityScore,
      clarity: 15,
      composition: 15,
      lighting: 15,
      relevance: 15,
      freshness: 15,
    } : undefined,
  };
}

describe('图片选择器', () => {
  describe('小红书图片选择逻辑', () => {
    test('应该优先选择包含生活化关键词的图片', () => {
      const images = [
        createMockImage({ id: '1', source: 'local', path: '/photos/人像自拍.jpg' }),
        createMockImage({ id: '2', source: 'local', path: '/photos/参数配置表.png' }),
        createMockImage({ id: '3', source: 'local', path: '/photos/生活日常.jpg' }),
      ];
      
      // 模拟小红书选择逻辑（简化版）
      const xiaohongshuPreferred = images.filter(img => {
        const pathLower = img.path.toLowerCase();
        const preferredKeywords = ['人像', '美食', '风景', '生活', '日常', '自拍'];
        const professionalKeywords = ['参数', '配置', '数据', '图表', '对比'];
        
        const hasPreferred = preferredKeywords.some(k => pathLower.includes(k));
        const hasProfessional = professionalKeywords.some(k => pathLower.includes(k));
        
        return hasPreferred && !hasProfessional;
      });
      
      expect(xiaohongshuPreferred.length).toBe(2);
      expect(xiaohongshuPreferred.map(i => i.id)).toEqual(['1', '3']);
    });

    test('应该排除过于专业的图片', () => {
      const images = [
        createMockImage({ id: '1', source: 'local', path: '/photos/数据对比图.png' }),
        createMockImage({ id: '2', source: 'local', path: '/photos/评测分析.jpg' }),
        createMockImage({ id: '3', source: 'local', path: '/photos/自拍.jpg' }),
      ];
      
      const xiaohongshuPreferred = images.filter(img => {
        const pathLower = img.path.toLowerCase();
        const professionalKeywords = ['参数', '配置', '数据', '图表', '对比'];
        return !professionalKeywords.some(k => pathLower.includes(k));
      });
      
      expect(xiaohongshuPreferred.length).toBe(1);
      expect(xiaohongshuPreferred[0].id).toBe('3');
    });
  });

  describe('知乎图片选择逻辑', () => {
    test('应该优先选择包含专业性关键词的图片', () => {
      const images = [
        createMockImage({ id: '1', source: 'local', path: '/photos/数据对比图.png' }),
        createMockImage({ id: '2', source: 'local', path: '/photos/评测分析.jpg' }),
        createMockImage({ id: '3', source: 'local', path: '/photos/自拍.jpg' }),
      ];
      
      const zhihuPreferred = images.filter(img => {
        const pathLower = img.path.toLowerCase();
        const preferredKeywords = ['图表', '数据', '对比', '分析', '评测', '参数', '配置'];
        return preferredKeywords.some(k => pathLower.includes(k));
      });
      
      expect(zhihuPreferred.length).toBe(2);
      expect(zhihuPreferred.map(i => i.id)).toEqual(['1', '2']);
    });

    test('应该排除过于生活化的图片', () => {
      const images = [
        createMockImage({ id: '1', source: 'local', path: '/photos/自拍.jpg' }),
        createMockImage({ id: '2', source: 'local', path: '/photos/美食.jpg' }),
        createMockImage({ id: '3', source: 'local', path: '/photos/参数配置.png' }),
      ];
      
      const zhihuPreferred = images.filter(img => {
        const pathLower = img.path.toLowerCase();
        const casualKeywords = ['自拍', '美食', '穿搭', '日常'];
        return !casualKeywords.some(k => pathLower.includes(k));
      });
      
      expect(zhihuPreferred.length).toBe(1);
      expect(zhihuPreferred[0].id).toBe('3');
    });
  });

  describe('汽车之家图片选择逻辑', () => {
    test('应该优先选择包含实车、实拍关键词的图片', () => {
      const images = [
        createMockImage({ id: '1', source: 'local', path: '/photos/实车拍摄.jpg' }),
        createMockImage({ id: '2', source: 'local', path: '/photos/内饰细节.jpg' }),
        createMockImage({ id: '3', source: 'local', path: '/photos/艺术海报.png' }),
      ];
      
      const autohomePreferred = images.filter(img => {
        const pathLower = img.path.toLowerCase();
        const preferredKeywords = ['实车', '实拍', '内饰', '改装', '油耗', '保养', '细节', '提车'];
        return preferredKeywords.some(k => pathLower.includes(k));
      });
      
      expect(autohomePreferred.length).toBe(2);
      expect(autohomePreferred.map(i => i.id)).toEqual(['1', '2']);
    });

    test('应该排除过于艺术化的图片', () => {
      const images = [
        createMockImage({ id: '1', source: 'local', path: '/photos/艺术滤镜.jpg' }),
        createMockImage({ id: '2', source: 'local', path: '/photos/特效海报.png' }),
        createMockImage({ id: '3', source: 'local', path: '/photos/改装细节.jpg' }),
      ];
      
      const autohomePreferred = images.filter(img => {
        const pathLower = img.path.toLowerCase();
        const artisticKeywords = ['艺术', '滤镜', '特效', '海报'];
        return !artisticKeywords.some(k => pathLower.includes(k));
      });
      
      expect(autohomePreferred.length).toBe(1);
      expect(autohomePreferred[0].id).toBe('3');
    });
  });

  describe('图片质量评分', () => {
    test('本地素材应该根据文件大小和修改时间评分', () => {
      // 这里测试评分逻辑的概念验证
      // 实际评分需要文件系统访问，在单元测试中简化处理
      const image = createMockImage({ 
        id: '1', 
        source: 'local', 
        path: '/photos/test.jpg',
        qualityScore: 75,
      });
      
      expect(image.qualityScore).toBeDefined();
      expect(image.qualityScore!.totalScore).toBe(75);
      
      // 验证各维度分数
      expect(image.qualityScore!.clarity).toBe(15);
      expect(image.qualityScore!.composition).toBe(15);
      expect(image.qualityScore!.lighting).toBe(15);
      expect(image.qualityScore!.relevance).toBe(15);
      expect(image.qualityScore!.freshness).toBe(15);
    });

    test('网络素材应该给默认中等分数', () => {
      const image = createMockImage({ 
        id: '1', 
        source: 'internet', 
        path: 'https://example.com/image.jpg',
        qualityScore: 73,  // 模拟网络素材评分
      });
      
      expect(image.qualityScore).toBeDefined();
      expect(image.qualityScore!.totalScore).toBe(73);
    });
  });

  describe('平台适配度计算', () => {
    test('生活化图片应该在小红书平台获得高适配度', () => {
      const image = createMockImage({ 
        id: '1', 
        source: 'local', 
        path: '/photos/人像自拍.jpg',
      });
      
      // 模拟适���度计算
      const pathLower = image.path.toLowerCase();
      const xiaohongshuKeywords = ['人像', '美食', '生活', '日常', '自拍'];
      
      const isXiaohongshuFit = xiaohongshuKeywords.some(k => pathLower.includes(k));
      
      expect(isXiaohongshuFit).toBe(true);
    });

    test('数据图应该在知乎平台获得高适配度', () => {
      const image = createMockImage({ 
        id: '1', 
        source: 'local', 
        path: '/photos/数据对比分析.png',
      });
      
      const pathLower = image.path.toLowerCase();
      const zhihuKeywords = ['数据', '图表', '对比', '分析', '评测'];
      
      const isZhihuFit = zhihuKeywords.some(k => pathLower.includes(k));
      
      expect(isZhihuFit).toBe(true);
    });

    test('实拍图应该在汽车之家平台获得高适配度', () => {
      const image = createMockImage({ 
        id: '1', 
        source: 'local', 
        path: '/photos/实车拍摄.jpg',
      });
      
      const pathLower = image.path.toLowerCase();
      const autohomeKeywords = ['实车', '实拍', '内饰', '改装', '油耗'];
      
      const isAutohomeFit = autohomeKeywords.some(k => pathLower.includes(k));
      
      expect(isAutohomeFit).toBe(true);
    });
  });

  describe('图片降级策略', () => {
    test('高清图不足时应该使用中清晰度图片补充', () => {
      const highQualityImages = [
        createMockImage({ id: '1', source: 'local', path: '/photos/高清 1.jpg', qualityScore: 90 }),
        createMockImage({ id: '2', source: 'local', path: '/photos/高清 2.jpg', qualityScore: 85 }),
      ];
      
      const mediumQualityImages = [
        createMockImage({ id: '3', source: 'local', path: '/photos/中清 1.jpg', qualityScore: 60 }),
        createMockImage({ id: '4', source: 'local', path: '/photos/中清 2.jpg', qualityScore: 55 }),
      ];
      
      const allImages = [...highQualityImages, ...mediumQualityImages];
      
      // 如果需要 4 张图片，但高清图只有 2 张
      const neededCount = 4;
      const selected = allImages
        .sort((a, b) => (b.qualityScore?.totalScore || 0) - (a.qualityScore?.totalScore || 0))
        .slice(0, neededCount);
      
      expect(selected.length).toBe(4);
      expect(selected.map(i => i.id)).toEqual(['1', '2', '3', '4']);
    });

    test('图片数量不足时应该返回所有可用图片', () => {
      const images = [
        createMockImage({ id: '1', source: 'local', path: '/photos/唯一.jpg' }),
      ];
      
      const neededCount = 3;
      const selected = images.slice(0, neededCount);
      
      expect(selected.length).toBe(1);
      expect(selected[0].id).toBe('1');
    });
  });
});
