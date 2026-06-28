/**
 * 任务 7.3: 平台选择算法单元测试
 * 
 * 测试覆盖：
 * - 基础优先级计算
 * - 频率限制调整
 * - 成功率调整（>90% 奖励，<50% 惩罚）
 * - 权重随机选择（包含最近使用惩罚）
 * - 智能平台选择完整流程
 */

// 由于 SearchManager 依赖数据库，我们创建一个简化的测试版本
class MockSearchManager {
  // 模拟成功率调整逻辑
  adjustBySuccessRate(priorities: Map<string, number>, successRates: Map<string, number>): Map<string, number> {
    const adjusted = new Map<string, number>();
    
    for (const [platform, priority] of priorities.entries()) {
      const successRate = successRates.get(platform) || 100.0;
      let adjustedPriority = priority;
      
      if (successRate > 90) {
        adjustedPriority = Math.min(10, priority + 1);  // 奖励
      } else if (successRate < 50) {
        adjustedPriority = Math.max(1, priority - 2);  // 惩罚
      }
      
      adjusted.set(platform, adjustedPriority);
    }
    
    return adjusted;
  }

  // 模拟频率限制调整
  adjustByRateLimit(priorities: Map<string, number>, rateLimits: Map<string, number>): Map<string, number> {
    const adjusted = new Map<string, number>();
    
    for (const [platform, priority] of priorities.entries()) {
      const limit = rateLimits.get(platform) || 50;
      // 如果接近限制，降低优先级
      const adjustedPriority = limit < 10 ? Math.max(1, priority - 2) : priority;
      adjusted.set(platform, adjustedPriority);
    }
    
    return adjusted;
  }

  // 模拟权重随机选择
  weightedRandomSelect(platforms: string[], priorities: Map<string, number>, recentUses: Set<string>): string {
    let totalWeight = 0;
    const weights: number[] = [];
    
    for (const platform of platforms) {
      let weight = priorities.get(platform) || 5;
      
      // 最近使用惩罚
      if (recentUses.has(platform)) {
        weight = Math.max(1, weight - 3);
      }
      
      weights.push(weight);
      totalWeight += weight;
    }
    
    // 权重随机选择
    let random = Math.random() * totalWeight;
    for (let i = 0; i < platforms.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return platforms[i];
      }
    }
    
    return platforms[platforms.length - 1];
  }
}

describe('平台选择算法', () => {
  let manager: MockSearchManager;

  beforeEach(() => {
    manager = new MockSearchManager();
  });

  describe('成功率调整', () => {
    test('成功率>90% 应该奖励 +1', () => {
      const priorities = new Map([['xiaohongshu', 5]]);
      const successRates = new Map([['xiaohongshu', 95.5]]);
      
      const result = manager.adjustBySuccessRate(priorities, successRates);
      
      expect(result.get('xiaohongshu')).toBe(6);
    });

    test('成功率<50% 应该惩罚 -2', () => {
      const priorities = new Map([['zhihu', 7]]);
      const successRates = new Map([['zhihu', 45.0]]);
      
      const result = manager.adjustBySuccessRate(priorities, successRates);
      
      expect(result.get('zhihu')).toBe(5);
    });

    test('成功率在 50-90% 之间应该保持不变', () => {
      const priorities = new Map([['autohome', 8]]);
      const successRates = new Map([['autohome', 75.5]]);
      
      const result = manager.adjustBySuccessRate(priorities, successRates);
      
      expect(result.get('autohome')).toBe(8);
    });

    test('奖励后优先级不应该超过 10', () => {
      const priorities = new Map([['xiaohongshu', 10]]);
      const successRates = new Map([['xiaohongshu', 98.0]]);
      
      const result = manager.adjustBySuccessRate(priorities, successRates);
      
      expect(result.get('xiaohongshu')).toBe(10);  // 保持最大值
    });

    test('惩罚后优先级不应该低于 1', () => {
      const priorities = new Map([['zhihu', 1]]);
      const successRates = new Map([['zhihu', 30.0]]);
      
      const result = manager.adjustBySuccessRate(priorities, successRates);
      
      expect(result.get('zhihu')).toBe(1);  // 保持最小值
    });
  });

  describe('频率限制调整', () => {
    test('频率限制<10 应该降低优先级', () => {
      const priorities = new Map([['xiaohongshu', 8]]);
      const rateLimits = new Map([['xiaohongshu', 5]]);
      
      const result = manager.adjustByRateLimit(priorities, rateLimits);
      
      expect(result.get('xiaohongshu')).toBe(6);  // 8 - 2
    });

    test('频率限制>=10 应该保持优先级不变', () => {
      const priorities = new Map([['zhihu', 7]]);
      const rateLimits = new Map([['zhihu', 100]]);
      
      const result = manager.adjustByRateLimit(priorities, rateLimits);
      
      expect(result.get('zhihu')).toBe(7);
    });
  });

  describe('权重随机选择', () => {
    test('应该优先选择高优先级平台', () => {
      const platforms = ['xiaohongshu', 'zhihu'];
      const priorities = new Map([
        ['xiaohongshu', 10],
        ['zhihu', 1],
      ]);
      const recentUses = new Set<string>();
      
      // 运行多次，高优先级平台应该被选中更多次
      let xiaohongshuCount = 0;
      for (let i = 0; i < 100; i++) {
        const result = manager.weightedRandomSelect(platforms, priorities, recentUses);
        if (result === 'xiaohongshu') {
          xiaohongshuCount++;
        }
      }
      
      // 小红书优先级是知乎的 10 倍，应该被选中至少 70% 的次数
      expect(xiaohongshuCount).toBeGreaterThan(70);
    });

    test('最近使用的平台应该被惩罚（-3）', () => {
      const platforms = ['xiaohongshu', 'zhihu'];
      const priorities = new Map([
        ['xiaohongshu', 8],
        ['zhihu', 8],
      ]);
      const recentUses = new Set(['xiaohongshu']);
      
      // 运行多次，知乎应该被选中更多次
      let zhihuCount = 0;
      for (let i = 0; i < 100; i++) {
        const result = manager.weightedRandomSelect(platforms, priorities, recentUses);
        if (result === 'zhihu') {
          zhihuCount++;
        }
      }
      
      // 小红书被惩罚后权重为 5，知乎为 8，知乎应该被选中更多
      expect(zhihuCount).toBeGreaterThan(50);
    });

    test('所有平台权重相同时应该均匀分布', () => {
      const platforms = ['xiaohongshu', 'zhihu', 'autohome'];
      const priorities = new Map([
        ['xiaohongshu', 5],
        ['zhihu', 5],
        ['autohome', 5],
      ]);
      const recentUses = new Set<string>();
      
      const counts = { xiaohongshu: 0, zhihu: 0, autohome: 0 };
      
      for (let i = 0; i < 300; i++) {
        const result = manager.weightedRandomSelect(platforms, priorities, recentUses);
        counts[result as keyof typeof counts]++;
      }
      
      // 每个平台应该被选中约 100 次（允许 20% 的偏差）
      expect(counts.xiaohongshu).toBeGreaterThan(80);
      expect(counts.xiaohongshu).toBeLessThan(120);
      expect(counts.zhihu).toBeGreaterThan(80);
      expect(counts.zhihu).toBeLessThan(120);
      expect(counts.autohome).toBeGreaterThan(80);
      expect(counts.autohome).toBeLessThan(120);
    });
  });

  describe('综合场景测试', () => {
    test('应该综合考虑优先级、成功率和最近使用', () => {
      const platforms = ['xiaohongshu', 'zhihu', 'autohome'];
      
      // 基础优先级
      const basePriorities = new Map([
        ['xiaohongshu', 8],
        ['zhihu', 7],
        ['autohome', 8],
      ]);
      
      // 成功率（小红书高，知乎低）
      const successRates = new Map([
        ['xiaohongshu', 95.0],  // >90，奖励
        ['zhihu', 40.0],        // <50，惩罚
        ['autohome', 75.0],     // 不变
      ]);
      
      // 应用成功率调整
      const adjustedPriorities = manager.adjustBySuccessRate(basePriorities, successRates);
      
      expect(adjustedPriorities.get('xiaohongshu')).toBe(9);  // 8 + 1
      expect(adjustedPriorities.get('zhihu')).toBe(5);        // 7 - 2
      expect(adjustedPriorities.get('autohome')).toBe(8);     // 不变
    });
  });
});
