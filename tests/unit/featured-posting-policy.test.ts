jest.mock('../../src/utils/config', () => ({
  loadConfig: () => ({
    featuredPosting: {
      enabled: true,
      minContentChars: 250,
      minImages: 4,
      recommendedImages: 6,
      maxGenerateRetries: 2,
      maxImageUploadRetries: 2,
    },
  }),
}));

import { evaluateFeaturedPostingReadiness } from '../../src/services/featured-posting-policy';

describe('featured-posting-policy', () => {
  it('字数不足时应返回不达标与原因', () => {
    const readiness = evaluateFeaturedPostingReadiness({
      title: '奥迪 A4L 驾驶体验分享',
      content: '短内容',
      imageUrls: ['1', '2', '3', '4'],
    });
    expect(readiness.eligible).toBe(false);
    expect(readiness.reasons.join(' ')).toContain('字数不足');
  });

  it('图片不足时应返回不达标与原因', () => {
    const readiness = evaluateFeaturedPostingReadiness({
      title: '奥迪 A4L 驾驶体验分享',
      content: '字'.repeat(300),
      imageUrls: ['1', '2', '3'],
    });
    expect(readiness.eligible).toBe(false);
    expect(readiness.reasons.join(' ')).toContain('图片不足');
  });

  it('全部达标时应返回 eligible=true', () => {
    const readiness = evaluateFeaturedPostingReadiness({
      title: '奥迪 A4L 驾驶体验分享',
      content: '字'.repeat(300),
      imageUrls: ['1', '2', '3', '4'],
    });
    expect(readiness.eligible).toBe(true);
    // 硬性门槛达标，但可能有软性约束提醒
    expect(readiness.reasons.filter(r => r.includes('字数不足') || r.includes('图片不足'))).toEqual([]);
  });

  it('应返回可观测 metrics', () => {
    const readiness = evaluateFeaturedPostingReadiness({
      title: '奥迪 A4L 驾驶体验分享',
      content: '字'.repeat(260),
      imageUrls: ['1', '2', '3', '4', '5'],
    });
    expect(readiness.metrics.contentChars).toBe(260);
    expect(readiness.metrics.imageUrls).toBe(5);
  });

  it('标题质量评估：标题过短时仍应达标（软性约束）', () => {
    const readiness = evaluateFeaturedPostingReadiness({
      title: '短标题', // 太短（3 字）
      content: '字'.repeat(300),
      imageUrls: ['1', '2', '3', '4'],
    });
    // 硬性门槛达标，应该合格（标题质量是软性约束）
    expect(readiness.eligible).toBe(true);
  });

  it('标题质量评估：好标题应达标', () => {
    const readiness = evaluateFeaturedPostingReadiness({
      title: '如何保养奥迪 A4L？3 个技巧分享', // 包含关键词和提问句式
      content: '字'.repeat(300),
      imageUrls: ['1', '2', '3', '4'],
    });
    expect(readiness.eligible).toBe(true);
  });

  it('内容结构评估：有结构的帖子应达标', () => {
    const content = '今天天气不错，开车出去体验了一番。驾驶感受很好，动力响应及时，转向精准。外观也很漂亮，内饰豪华。空间表现不错，座椅舒适。总体来说很满意这次购车体验。' + '字'.repeat(150);
    const readiness = evaluateFeaturedPostingReadiness({
      title: '奥迪 A4L 驾驶体验分享',
      content: content + '\n\n## 驾驶感受\n开起来很舒服，动力响应及时，转向精准。\n\n1. 第一点：加速性能优秀\n2. 第二点：操控感很好\n\n欢迎大家分享你的驾驶体验！',
      imageUrls: ['1', '2', '3', '4'],
    });
    expect(readiness.eligible).toBe(true);
  });

  it('图片质量评估：7 张图片应返回优秀', () => {
    const readiness = evaluateFeaturedPostingReadiness({
      title: '奥迪 A4L 驾驶体验分享',
      content: '字'.repeat(300),
      imageUrls: ['1', '2', '3', '4', '5', '6', '7'],
    });
    expect(readiness.eligible).toBe(true);
  });
});

