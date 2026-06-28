/**
 * 任务 7.6: A/B 测试框架
 * 
 * 用于对比优化前后的发帖效果：
 * - 优化前：简单轮询策略 + 通用提示词
 * - 优化后：智能平台选择 + 分平台提示词
 * 
 * 测试指标：
 * - 帖子曝光量
 * - 互动率（点赞/评论/收藏）
 * - 内容质量评分
 * - 平台适配度评分
 */

export interface ABTestMetrics {
  exposure: number;      // 曝光量
  likes: number;         // 点赞数
  comments: number;      // 评论数
  favorites: number;     // 收藏数
  qualityScore: number;  // 内容质量评分（0-100）
  adaptabilityScore: number;  // 平台适配度评分（0-100）
}

export interface ABTestGroup {
  name: string;  // 'control' | 'experiment'
  platform: string;
  postCount: number;
  metrics: ABTestMetrics;
}

export interface ABTestResult {
  metricName: string;
  controlValue: number;
  experimentValue: number;
  improvement: number;  // 提升百分比（%）
  isSignificant: boolean;
}

/**
 * A/B 测试框架类
 */
export class ABTestFramework {
  private controlGroup: Map<string, ABTestGroup> = new Map();
  private experimentGroup: Map<string, ABTestGroup> = new Map();

  /**
   * 添加对照组数据（优化前）
   */
  addControlData(platform: string, metrics: ABTestMetrics): void {
    const group: ABTestGroup = {
      name: 'control',
      platform,
      postCount: 1,
      metrics,
    };
    
    const existing = this.controlGroup.get(platform);
    if (existing) {
      // 累加数据
      existing.postCount++;
      existing.metrics.exposure += metrics.exposure;
      existing.metrics.likes += metrics.likes;
      existing.metrics.comments += metrics.comments;
      existing.metrics.favorites += metrics.favorites;
      existing.metrics.qualityScore = 
        (existing.metrics.qualityScore * (existing.postCount - 1) + metrics.qualityScore) / existing.postCount;
      existing.metrics.adaptabilityScore = 
        (existing.metrics.adaptabilityScore * (existing.postCount - 1) + metrics.adaptabilityScore) / existing.postCount;
    } else {
      this.controlGroup.set(platform, group);
    }
  }

  /**
   * 添加实验组数据（优化后）
   */
  addExperimentData(platform: string, metrics: ABTestMetrics): void {
    const group: ABTestGroup = {
      name: 'experiment',
      platform,
      postCount: 1,
      metrics,
    };
    
    const existing = this.experimentGroup.get(platform);
    if (existing) {
      existing.postCount++;
      existing.metrics.exposure += metrics.exposure;
      existing.metrics.likes += metrics.likes;
      existing.metrics.comments += metrics.comments;
      existing.metrics.favorites += metrics.favorites;
      existing.metrics.qualityScore = 
        (existing.metrics.qualityScore * (existing.postCount - 1) + metrics.qualityScore) / existing.postCount;
      existing.metrics.adaptabilityScore = 
        (existing.metrics.adaptabilityScore * (existing.postCount - 1) + metrics.adaptabilityScore) / existing.postCount;
    } else {
      this.experimentGroup.set(platform, group);
    }
  }

  /**
   * 计算提升百分比
   */
  private calculateImprovement(control: number, experiment: number): number {
    if (control === 0) return 0;
    return ((experiment - control) / control) * 100;
  }

  /**
   * 判断差异是否显著（简化版 t 检验）
   */
  private isSignificant(control: number, experiment: number, threshold: number = 10): boolean {
    const improvement = this.calculateImprovement(control, experiment);
    return Math.abs(improvement) > threshold;
  }

  /**
   * 生成 A/B 测试报告
   */
  generateReport(platform: string): ABTestResult[] {
    const control = this.controlGroup.get(platform);
    const experiment = this.experimentGroup.get(platform);
    
    if (!control || !experiment) {
      throw new Error(`平台 ${platform} 的测试数据不完整`);
    }
    
    // 计算平均值
    const controlAvg = {
      exposure: control.metrics.exposure / control.postCount,
      likes: control.metrics.likes / control.postCount,
      comments: control.metrics.comments / control.postCount,
      favorites: control.metrics.favorites / control.postCount,
      qualityScore: control.metrics.qualityScore,
      adaptabilityScore: control.metrics.adaptabilityScore,
    };
    
    const experimentAvg = {
      exposure: experiment.metrics.exposure / experiment.postCount,
      likes: experiment.metrics.likes / experiment.postCount,
      comments: experiment.metrics.comments / experiment.postCount,
      favorites: experiment.metrics.favorites / experiment.postCount,
      qualityScore: experiment.metrics.qualityScore,
      adaptabilityScore: experiment.metrics.adaptabilityScore,
    };
    
    const results: ABTestResult[] = [
      {
        metricName: '曝光量',
        controlValue: parseFloat(controlAvg.exposure.toFixed(2)),
        experimentValue: parseFloat(experimentAvg.exposure.toFixed(2)),
        improvement: parseFloat(this.calculateImprovement(controlAvg.exposure, experimentAvg.exposure).toFixed(2)),
        isSignificant: this.isSignificant(controlAvg.exposure, experimentAvg.exposure),
      },
      {
        metricName: '点赞数',
        controlValue: parseFloat(controlAvg.likes.toFixed(2)),
        experimentValue: parseFloat(experimentAvg.likes.toFixed(2)),
        improvement: parseFloat(this.calculateImprovement(controlAvg.likes, experimentAvg.likes).toFixed(2)),
        isSignificant: this.isSignificant(controlAvg.likes, experimentAvg.likes),
      },
      {
        metricName: '评论数',
        controlValue: parseFloat(controlAvg.comments.toFixed(2)),
        experimentValue: parseFloat(experimentAvg.comments.toFixed(2)),
        improvement: parseFloat(this.calculateImprovement(controlAvg.comments, experimentAvg.comments).toFixed(2)),
        isSignificant: this.isSignificant(controlAvg.comments, experimentAvg.comments),
      },
      {
        metricName: '收藏数',
        controlValue: parseFloat(controlAvg.favorites.toFixed(2)),
        experimentValue: parseFloat(experimentAvg.favorites.toFixed(2)),
        improvement: parseFloat(this.calculateImprovement(controlAvg.favorites, experimentAvg.favorites).toFixed(2)),
        isSignificant: this.isSignificant(controlAvg.favorites, experimentAvg.favorites),
      },
      {
        metricName: '内容质量评分',
        controlValue: parseFloat(controlAvg.qualityScore.toFixed(2)),
        experimentValue: parseFloat(experimentAvg.qualityScore.toFixed(2)),
        improvement: parseFloat(this.calculateImprovement(controlAvg.qualityScore, experimentAvg.qualityScore).toFixed(2)),
        isSignificant: this.isSignificant(controlAvg.qualityScore, experimentAvg.qualityScore, 5),
      },
      {
        metricName: '平台适配度评分',
        controlValue: parseFloat(controlAvg.adaptabilityScore.toFixed(2)),
        experimentValue: parseFloat(experimentAvg.adaptabilityScore.toFixed(2)),
        improvement: parseFloat(this.calculateImprovement(controlAvg.adaptabilityScore, experimentAvg.adaptabilityScore).toFixed(2)),
        isSignificant: this.isSignificant(controlAvg.adaptabilityScore, experimentAvg.adaptabilityScore, 5),
      },
    ];
    
    return results;
  }

  /**
   * 打印测试报告
   */
  printReport(platform: string): void {
    console.log(`\n========== ${platform} A/B 测试报告 ==========`);
    console.log(`对照组帖子数：${this.controlGroup.get(platform)?.postCount}`);
    console.log(`实验组帖子数：${this.experimentGroup.get(platform)?.postCount}\n`);
    
    const results = this.generateReport(platform);
    
    console.log('指标\t\t\t优化前\t\t优化后\t\t提升\t\t显著');
    console.log('─'.repeat(80));
    
    for (const result of results) {
      const symbol = result.improvement > 0 ? '↑' : result.improvement < 0 ? '↓' : '=';
      const significant = result.isSignificant ? '✓' : '✗';
      
      console.log(
        `${result.metricName.padEnd(16)}\t` +
        `${result.controlValue.toFixed(2).padStart(10)}\t` +
        `${result.experimentValue.toFixed(2).padStart(10)}\t` +
        `${symbol}${Math.abs(result.improvement).toFixed(2)}%`.padStart(12) + '\t' +
        `${significant}`
      );
    }
    
    console.log('─'.repeat(80));
    
    // 总体评价
    const significantCount = results.filter(r => r.isSignificant && r.improvement > 0).length;
    if (significantCount >= 4) {
      console.log('✅ 优化效果显著，建议全面推广');
    } else if (significantCount >= 2) {
      console.log('⚠️ 优化效果一般，建议继续观察');
    } else {
      console.log('❌ 优化效果不明显，建议调整策略');
    }
  }

  /**
   * 清除所有测试数据
   */
  clear(): void {
    this.controlGroup.clear();
    this.experimentGroup.clear();
  }
}

/**
 * 使用示例：
 * 
 * const abTest = new ABTestFramework();
 * 
 * // 添加对照组数据（优化前）
 * abTest.addControlData('xiaohongshu', {
 *   exposure: 1000,
 *   likes: 50,
 *   comments: 10,
 *   favorites: 20,
 *   qualityScore: 65,
 *   adaptabilityScore: 60,
 * });
 * 
 * // 添加实验组数据（优化后）
 * abTest.addExperimentData('xiaohongshu', {
 *   exposure: 1500,
 *   likes: 100,
 *   comments: 25,
 *   favorites: 40,
 *   qualityScore: 85,
 *   adaptabilityScore: 90,
 * });
 * 
 * // 生成报告
 * abTest.printReport('xiaohongshu');
 */
