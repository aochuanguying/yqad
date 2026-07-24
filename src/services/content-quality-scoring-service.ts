/**
 * 内容质量评分服务
 * 
 * 功能：
 * 1. 多维度内容质量评分（完整性、原创性、多样性、吸引力）
 * 2. 加权综合评分计算
 * 3. 评分详情和优化建议生成
 */

import { getLogger } from '../utils/logger';
import { contentDeduplicationService } from './content-deduplication-service';
import { getFeaturedPostingStorage } from '../storage/mysql/featured-posting-storage';
import { getContentQualityScoringStorage } from '../storage/mysql/content-quality-scoring-storage';

const logger = getLogger('content-quality-scoring');

/**
 * 评分维度
 */
export interface ScoringDimensions {
  completeness: number;      // 完整性 (0-100)
  originality: number;       // 原创性 (0-100)
  diversity: number;         // 多样性 (0-100)
  attractiveness: number;    // 吸引力 (0-100)
}

/**
 * 评分详情
 */
export interface ScoringDetails {
  dimensions: ScoringDimensions;
  weights: {
    completeness: number;
    originality: number;
    diversity: number;
    attractiveness: number;
  };
  finalScore: number;
  level: 'excellent' | 'good' | 'fair' | 'poor';
  suggestions: string[];
}

/**
 * 评分输入数据
 */
export interface ScoringInput {
  title: string;
  content: string;
  imageCount?: number;
  similarityScore?: number;  // 相似度得分（来自去重服务）
}

/**
 * 内容质量评分服务类
 */
class ContentQualityScoringService {
  /**
   * 评估内容完整性
   * 评分维度：标题长度、正文长度、图片数量
   */
  private async evaluateCompleteness(input: ScoringInput): Promise<number> {
    let minContentChars = 250;
    let minImages = 4;
    try {
      const featuredConfig = await getFeaturedPostingStorage().getConfig();
      if (featuredConfig) {
        minContentChars = featuredConfig.minContentChars;
        minImages = featuredConfig.minImages;
      }
    } catch (error: any) {
      // 使用默认值
    }

    let score = 0;

    // 标题评分 (0-30 分)
    const titleLength = input.title.length;
    if (titleLength >= 10 && titleLength <= 30) {
      score += 30;  // 理想长度
    } else if (titleLength >= 5 && titleLength < 10) {
      score += 20;  // 偏短
    } else if (titleLength > 30 && titleLength <= 50) {
      score += 25;  // 偏长但可接受
    } else if (titleLength < 5) {
      score += 5;   // 太短
    } else {
      score += 10;  // 太长
    }

    // 正文评分 (0-50 分)
    const contentLength = input.content.length;
    if (contentLength >= minContentChars) {
      score += 50;  // 达到精华帖要求
    } else if (contentLength >= minContentChars * 0.8) {
      score += 40;  // 接近要求
    } else if (contentLength >= minContentChars * 0.6) {
      score += 30;  // 基本合格
    } else if (contentLength >= 100) {
      score += 20;  // 偏短
    } else {
      score += 10;  // 太短
    }

    // 图片评分 (0-20 分)
    const imageCount = input.imageCount || 0;
    if (imageCount >= 9) {
      score += 20;  // 图片丰富
    } else if (imageCount >= minImages) {
      score += 15;  // 达到要求
    } else if (imageCount >= 2) {
      score += 10;  // 有图片
    } else if (imageCount === 1) {
      score += 5;   // 单图
    } else {
      score += 0;   // 无图
    }

    return score;
  }

  /**
   * 评估内容原创性
   * 基于相似度检测结果
   */
  private async evaluateOriginality(input: ScoringInput): Promise<number> {
    // 如果已提供相似度分数，直接使用
    if (input.similarityScore !== undefined) {
      // 相似度越低，原创性越高
      // 相似度 0 -> 原创性 100
      // 相似度 0.7 -> 原创性 30
      // 相似度 1.0 -> 原创性 0
      const originality = Math.max(0, 100 - (input.similarityScore * 100));
      return Math.round(originality);
    }

    // 否则调用去重服务计算相似度
    try {
      const result = await contentDeduplicationService.checkSimilarity(input.title, input.content);
      const originality = Math.max(0, 100 - (result.maxSimilarity * 100));
      return Math.round(originality);
    } catch (error) {
      logger.warn(`原创性评估失败，使用默认分数：${error instanceof Error ? error.message : String(error)}`);
      return 50;  // 默认中等分数
    }
  }

  /**
   * 评估内容多样性
   * 评分维度：词汇丰富度、句式变化、表情符号使用
   */
  private evaluateDiversity(input: ScoringInput): number {
    let score = 0;

    // 词汇丰富度 (0-40 分)
    const words = this.tokenize(input.content);
    const uniqueWords = new Set(words);
    const vocabularyRatio = words.length > 0 ? uniqueWords.size / words.length : 0;
    
    if (vocabularyRatio >= 0.7) {
      score += 40;  // 词汇丰富
    } else if (vocabularyRatio >= 0.5) {
      score += 30;  // 较为丰富
    } else if (vocabularyRatio >= 0.3) {
      score += 20;  // 一般
    } else {
      score += 10;  // 词汇贫乏
    }

    // 句式变化 (0-40 分)
    const sentences = input.content.split(/[.!?。！？]/).filter(s => s.trim().length > 0);
    const sentenceLengths = sentences.map(s => s.length);
    const avgLength = sentenceLengths.length > 0 
      ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length 
      : 0;
    const lengthVariance = sentenceLengths.length > 1
      ? sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length
      : 0;

    if (sentences.length >= 5 && lengthVariance > 50) {
      score += 40;  // 句式多样
    } else if (sentences.length >= 3 && lengthVariance > 20) {
      score += 30;  // 有一定变化
    } else if (sentences.length >= 2) {
      score += 20;  // 基本变化
    } else {
      score += 10;  // 单调
    }

    // 表情符号使用 (0-20 分)
    const emojiCount = (input.content.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
    if (emojiCount >= 3 && emojiCount <= 10) {
      score += 20;  // 适度使用
    } else if (emojiCount >= 1 && emojiCount < 3) {
      score += 15;  // 少量使用
    } else if (emojiCount === 0) {
      score += 10;  // 无表情符号（可接受）
    } else {
      score += 5;   // 过度使用
    }

    return score;
  }

  /**
   * 评估内容吸引力
   * 评分维度：热点关键词、情感积极性、互动引导词
   */
  private evaluateAttractiveness(input: ScoringInput): number {
    let score = 0;

    // 热点关键词 (0-40 分)
    const hotKeywords = [
      '分享', '体验', '感受', '推荐', '攻略', '技巧', '心得',
      '真实', '详细', '全面', '深度', '第一视角', '沉浸式',
      '奥迪', '用车', '驾驶', '油耗', '空间', '配置', '性价比'
    ];
    
    const contentLower = input.content.toLowerCase();
    const titleLower = input.title.toLowerCase();
    let keywordCount = 0;
    
    for (const keyword of hotKeywords) {
      if (contentLower.includes(keyword) || titleLower.includes(keyword)) {
        keywordCount++;
      }
    }

    if (keywordCount >= 5) {
      score += 40;  // 热点丰富
    } else if (keywordCount >= 3) {
      score += 30;  // 有一定热点
    } else if (keywordCount >= 1) {
      score += 20;  // 少量热点
    } else {
      score += 10;  // 缺乏热点
    }

    // 情感积极性 (0-30 分)
    const positiveWords = [
      '满意', '喜欢', '不错', '很好', '优秀', '推荐', '值得',
      '开心', '愉快', '惊喜', '期待', '支持', '点赞', '棒'
    ];
    const negativeWords = [
      '失望', '后悔', '差劲', '不好', '问题', '故障', '投诉',
      '生气', '郁闷', '无语', '坑', '垃圾', '烂'
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      if (contentLower.includes(word) || titleLower.includes(word)) {
        positiveCount++;
      }
    }

    for (const word of negativeWords) {
      if (contentLower.includes(word) || titleLower.includes(word)) {
        negativeCount++;
      }
    }

    if (positiveCount >= 3 && negativeCount === 0) {
      score += 30;  // 非常积极
    } else if (positiveCount >= 2 && negativeCount === 0) {
      score += 25;  // 较为积极
    } else if (positiveCount >= 1 && negativeCount === 0) {
      score += 20;  // 正面
    } else if (positiveCount > negativeCount) {
      score += 15;  // 略偏正面
    } else if (negativeCount > 0) {
      score += 5;   // 包含负面内容
    } else {
      score += 10;  // 中性
    }

    // 互动引导词 (0-30 分)
    const interactionWords = [
      '欢迎', '交流', '讨论', '分享', '大家', '你们', '如何',
      '怎么', '什么', '吗', '呢', '？', '?', '欢迎留言', '求关注'
    ];

    let interactionCount = 0;
    for (const word of interactionWords) {
      if (contentLower.includes(word) || titleLower.includes(word)) {
        interactionCount++;
      }
    }

    if (interactionCount >= 3) {
      score += 30;  // 强互动性
    } else if (interactionCount >= 2) {
      score += 20;  // 有一定互动性
    } else if (interactionCount >= 1) {
      score += 10;  // 少量互动
    } else {
      score += 5;   // 缺乏互动
    }

    return score;
  }

  /**
   * 计算综合评分
   */
  async calculateScore(input: ScoringInput): Promise<ScoringDetails> {
    let weights = {
      completeness: 0.3,
      originality: 0.3,
      diversity: 0.2,
      attractiveness: 0.2,
    };
    try {
      const scoringConfig = await getContentQualityScoringStorage().getConfig();
      if (scoringConfig?.weights) {
        weights = scoringConfig.weights;
      }
    } catch (error: any) {
      // 使用默认值
    }

    // 各维度评分
    const completeness = await this.evaluateCompleteness(input);
    const originality = await this.evaluateOriginality(input);
    const diversity = this.evaluateDiversity(input);
    const attractiveness = this.evaluateAttractiveness(input);

    // 加权计算
    const finalScore = Math.round(
      completeness * (weights.completeness ?? 0.3) +
      originality * (weights.originality ?? 0.3) +
      diversity * (weights.diversity ?? 0.2) +
      attractiveness * 0.2
    );

    // 确定等级
    let level: 'excellent' | 'good' | 'fair' | 'poor';
    if (finalScore >= 85) {
      level = 'excellent';
    } else if (finalScore >= 70) {
      level = 'good';
    } else if (finalScore >= 60) {
      level = 'fair';
    } else {
      level = 'poor';
    }

    // 生成优化建议
    const suggestions = this.generateSuggestions({
      completeness,
      originality,
      diversity,
      attractiveness,
    }, input);

    logger.info(
      `质量评分：${finalScore}/100 (${level}) - ` +
      `完整性:${completeness}, 原创性:${originality}, ` +
      `多样性:${diversity}, 吸引力:${attractiveness}`
    );

    return {
      dimensions: {
        completeness,
        originality,
        diversity,
        attractiveness,
      },
      weights: {
        completeness: weights.completeness ?? 0.3,
        originality: weights.originality ?? 0.3,
        diversity: weights.diversity ?? 0.2,
        attractiveness: 0.2,
      },
      finalScore,
      level,
      suggestions,
    };
  }

  /**
   * 生成优化建议
   */
  private generateSuggestions(dimensions: ScoringDimensions, input: ScoringInput): string[] {
    const suggestions: string[] = [];

    // 完整性建议
    if (dimensions.completeness < 60) {
      if (input.title.length < 10) {
        suggestions.push('建议将标题扩展到 10-30 个字符，使其更具吸引力');
      }
      if (input.content.length < 200) {
        suggestions.push('建议增加内容长度至 250 字以上，提供更详细的分享');
      }
      if (!input.imageCount || input.imageCount < 4) {
        suggestions.push('建议添加 4-9 张图片，图文并茂提升内容质量');
      }
    }

    // 原创性建议
    if (dimensions.originality < 60) {
      suggestions.push('内容与其他帖子相似度较高，建议增加更多个人真实体验和观点');
    }

    // 多样性建议
    if (dimensions.diversity < 60) {
      suggestions.push('建议丰富表达方式，使用更多样化的词汇和句式');
      if (input.content.length > 0) {
        const sentences = input.content.split(/[.!?。！？]/).filter(s => s.trim().length > 0);
        if (sentences.length < 3) {
          suggestions.push('建议增加句子数量，使内容结构更加丰富');
        }
      }
    }

    // 吸引力建议
    if (dimensions.attractiveness < 60) {
      suggestions.push('建议增加热点关键词，如"分享"、"体验"、"攻略"等');
      suggestions.push('可以适当使用表情符号，增强内容的亲和力');
      suggestions.push('增加互动引导语，如"欢迎大家交流"、"你们觉得呢"等');
    }

    // 优秀内容的鼓励
    if (dimensions.completeness >= 80 && dimensions.originality >= 80) {
      suggestions.push('内容质量优秀，保持真实分享的风格！');
    }

    return suggestions;
  }

  /**
   * 文本分词（简化版）
   */
  private tokenize(text: string): string[] {
    if (!text) return [];
    
    // 中文按字符分词，英文按单词分词
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    
    return [...chineseChars, ...englishWords];
  }

  /**
   * 批量评分
   */
  async batchCalculateScore(inputs: ScoringInput[]): Promise<ScoringDetails[]> {
    return Promise.all(inputs.map(input => this.calculateScore(input)));
  }
}

// 导出单例
export const contentQualityScoringService = new ContentQualityScoringService();
