/**
 * 主题多样化服务
 * 
 * 功能：
 * 1. 基于使用次数的加权子方向选择
 * 2. 素材交叉使用策略
 * 3. AI 提纲变体生成
 * 4. 标题风格多样化
 * 5. 内容变体生成
 */

import * as path from 'path';
import { getLogger } from '../utils/logger';
import { generateContent } from '../ai/client';
import { getTopicUsageStorage } from '../storage/mysql/topic-usage-storage';

import { topicRecommendStorage } from '../storage/chroma/topic-recommend-storage';
import { embeddingVectorizer } from '../utils/embedding-vectorizer';

const logger = getLogger('topic-diversity');
const topicUsageStorage = getTopicUsageStorage();

/**
 * 标题风格类型
 */
export type TitleStyleType = 
  | 'question'      // 提问式
  | 'sharing'       // 分享式
  | 'review'        // 评测式
  | 'comparison'    // 对比式
  | 'numeric'       // 数字式
  | 'suspense';     // 悬念式

/**
 * 子方向使用记录
 */
export interface SubDirectionUsage {
  index: number;
  usedCount: number;
  lastUsedDate?: string;
}

/**
 * 素材使用记录
 */
export interface MaterialUsageRecord {
  materialPath: string;
  usedCount: number;
  lastUsedDate?: string;
  usedInPosts: string[];  // 帖子 ID 列表
}

/**
 * 扩展的主题接口
 */
export interface ExtendedTopic {
  id: string;
  title: string;
  direction: string;
  outline: string;
  materialPaths?: string[];
  useCount: number;
  maxUseCount: number;
  lastPostDate?: string;
  postHistory?: Array<{
    title: string;
    timestamp: string;
  }>;
  // 子方向列表（从 Topic 继承）
  subDirections?: Array<{
    direction: string;
    outline?: string;
  }>;
  // 新增字段
  subDirectionUsages?: SubDirectionUsage[];
  materialUsages?: MaterialUsageRecord[];
}

/**
 * 提纲变体
 */
export interface OutlineVariant {
  original: string;
  variant: string;
  style: string;
}

/**
 * 标题生成选项
 */
export interface TitleGenerationOptions {
  style?: TitleStyleType;
  baseTopic: string;
  keyPoints?: string[];
  emotion?: 'positive' | 'neutral' | 'excited';
}

/**
 * 内容变体选项
 */
export interface ContentVariantOptions {
  perspective?: 'first' | 'third';  // 第一人称/第三人称
  structure?: 'chronological' | 'problem-solution' | 'pros-cons';
  tone?: 'casual' | 'formal' | 'enthusiastic';
  detailLevel?: 'brief' | 'detailed' | 'comprehensive';
}

/**
 * 主题多样化服务类
 */
class TopicDiversityService {
  /**
   * 基于使用次数的加权子方向选择
   * 优先使用使用次数少的子方向
   */
  async selectBalancedSubDirection(topicId: string): Promise<number> {
    const subDirections = await topicUsageStorage.getSubDirectionStats(topicId);
    
    if (subDirections.length === 0) {
      logger.debug(`主题 "${topicId}" 没有子方向使用记录，使用默认选择`);
      return 0;
    }

    // 计算总使用次数的倒数作为权重
    const totalInverseWeight = subDirections.reduce((sum, usage) => {
      const inverseWeight = 1 / (usage.usedCount + 1);
      return sum + inverseWeight;
    }, 0);

    // 轮盘赌选择
    const random = Math.random() * totalInverseWeight;
    let cumulative = 0;

    for (let i = 0; i < subDirections.length; i++) {
      const inverseWeight = 1 / (subDirections[i].usedCount + 1);
      cumulative += inverseWeight;

      if (random <= cumulative) {
        logger.info(
          `选择子方向 #${i} (使用次数：${subDirections[i].usedCount}, ` +
          `权重：${(inverseWeight / totalInverseWeight * 100).toFixed(1)}%)`
        );
        return i;
      }
    }

    // 默认返回第一个
    return 0;
  }

  /**
   * 更新子方向使用记录
   */
  async updateSubDirectionUsage(topicId: string, subDirectionIndex: number): Promise<void> {
    try {
      // 获取当前使用记录
      const stats = await topicUsageStorage.getSubDirectionStats(topicId);
      const currentUsage = stats.find(u => u.index === subDirectionIndex);
      const newCount = (currentUsage?.usedCount || 0) + 1;

      // 更新到数据库
      await topicUsageStorage.upsertSubDirectionUsage({
        topicId,
        subDirectionIndex,
        usedCount: newCount,
        lastUsedDate: new Date(),
      });

      logger.debug(`已更新主题 "${topicId}" 子方向 #${subDirectionIndex} 的使用记录：${newCount}`);
    } catch (error) {
      logger.error(`更新子方向使用记录失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 选择未使用或最少使用的素材
   */
  async selectBalancedMaterials(topicId: string, allMaterials: string[], neededCount: number): Promise<string[]> {
    const materialUsages = await topicUsageStorage.getMaterialStats(topicId);

    if (allMaterials.length === 0) {
      logger.warn(`主题 "${topicId}" 没有素材路径`);
      return [];
    }

    // 如果没有使用记录，随机选择
    if (materialUsages.length === 0) {
      const selected = this.randomSelect(allMaterials, neededCount);
      logger.info(`无素材使用记录，随机选择 ${selected.length} 个素材`);
      return selected;
    }

    // 按使用次数排序，优先使用使用次数少的
    const sortedMaterials = [...allMaterials].sort((a, b) => {
      const usageA = materialUsages.find(u => u.path === a);
      const usageB = materialUsages.find(u => u.path === b);
      
      const countA = usageA ? usageA.usedCount : 0;
      const countB = usageB ? usageB.usedCount : 0;
      
      return countA - countB;
    });

    const selected = sortedMaterials.slice(0, neededCount);
    logger.info(
      `选择 ${selected.length} 个素材（优先使用使用次数少的）: ` +
      `${selected.map(s => path.basename(s)).join(', ')}`
    );

    return selected;
  }

  /**
   * 更新素材使用记录
   */
  async updateMaterialUsage(topicId: string, materialPaths: string[], postId?: string): Promise<void> {
    try {
      const now = new Date();

      for (const materialPath of materialPaths) {
        // 获取当前使用记录
        const stats = await topicUsageStorage.getMaterialStats(topicId);
        const currentUsage = stats.find(u => u.path === materialPath);
        const newCount = (currentUsage?.usedCount || 0) + 1;
        
        // 更新帖子 ID 列表
        const usedInPosts = postId 
          ? [...(currentUsage?.usedInPosts || []), postId]
          : (currentUsage?.usedInPosts || []);

        // 更新到数据库
        await topicUsageStorage.upsertMaterialUsage({
          topicId,
          materialPath,
          usedCount: newCount,
          lastUsedDate: now,
          usedInPosts,
        });
      }

      logger.debug(`已更新主题 "${topicId}" 的 ${materialPaths.length} 个素材使用记录`);
    } catch (error) {
      logger.error(`更新素材使用记录失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * AI 生成提纲变体
   */
  async generateOutlineVariant(originalOutline: string, topicTitle: string): Promise<OutlineVariant> {
    const styles = [
      '问题 - 解决',
      '时间顺序',
      '对比分析',
      '体验分享',
      '技巧总结',
      '故事叙述'
    ];

    const selectedStyle = styles[Math.floor(Math.random() * styles.length)];

    const systemPrompt = `你是内容策划专家。根据原始提纲，生成一个不同风格的变体。
要求：
1. 保持核心主题不变
2. 改变叙述结构和角度
3. 使用"${selectedStyle}"风格
4. 输出 JSON 格式：{"original": "原提纲", "variant": "新提纲", "style": "风格名称"}`;

    const userPrompt = `原始提纲：${originalOutline}
主题：${topicTitle}

请生成一个${selectedStyle}风格的提纲变体。`;

    try {
      const response = await generateContent({ systemPrompt, userPrompt });
      const variant = this.parseOutlineVariant(response, originalOutline, selectedStyle);
      
      logger.info(
        `生成提纲变体：风格="${selectedStyle}", ` +
        `原长度=${originalOutline.length}, 新长度=${variant.variant.length}`
      );

      return variant;
    } catch (error) {
      logger.warn(`生成提纲变体失败，使用原提纲：${error instanceof Error ? error.message : String(error)}`);
      return {
        original: originalOutline,
        variant: originalOutline,
        style: 'original',
      };
    }
  }

  /**
   * 解析 AI 返回的提纲变体
   */
  private parseOutlineVariant(response: string, original: string, style: string): OutlineVariant {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          original: parsed.original || original,
          variant: parsed.variant || original,
          style: parsed.style || style,
        };
      }
    } catch (e) {
      logger.debug(`解析提纲变体失败：${e instanceof Error ? e.message : String(e)}`);
    }

    // 降级处理：直接使用 AI 返回作为变体
    return {
      original,
      variant: response.trim(),
      style,
    };
  }

  /**
   * 生成多样化标题
   */
  async generateDiverseTitle(options: TitleGenerationOptions): Promise<string> {
    const style = options.style || this.selectRandomStyle();
    const emotion = options.emotion || 'neutral';

    const stylePrompts: Record<TitleStyleType, string> = {
      question: '用提问的方式，引发读者好奇心',
      sharing: '用分享的口吻，像朋友间交流',
      review: '用评测的角度，客观分析优缺点',
      comparison: '用对比的手法，突出差异化',
      numeric: '用数字概括，清晰直观',
      suspense: '用悬念的方式，吸引点击',
    };

    const emotionWords: Record<string, string[]> = {
      positive: ['满意', '惊喜', '推荐', '值得'],
      neutral: ['分享', '记录', '感受', '体验'],
      excited: ['太棒了', '超赞', '必须', '绝对'],
    };

    const systemPrompt = `你是标题创作专家。根据要求生成吸引人的标题。
风格要求：${stylePrompts[style]}
情感倾向：${emotionWords[emotion].join('、')}
长度：15-30 字
不要标点符号结尾`;

    const userPrompt = `基础话题：${options.baseTopic}
关键点：${options.keyPoints?.join('、') || '无'}

请生成一个${style}风格的标题。`;

    try {
      const response = await generateContent({ systemPrompt, userPrompt });
      const title = response.trim().replace(/[.!?。！？]$/, '');
      
      logger.info(`生成${style}风格标题："${title}"`);
      return title;
    } catch (error) {
      logger.warn(`生成标题失败，使用基础话题：${error instanceof Error ? error.message : String(error)}`);
      return options.baseTopic;
    }
  }

  /**
   * 随机选择标题风格
   */
  private selectRandomStyle(): TitleStyleType {
    const styles: TitleStyleType[] = [
      'question', 'sharing', 'review', 
      'numeric', 'suspense', 'comparison'
    ];
    
    // 提问式和分享式权重更高
    const weights = [0.25, 0.25, 0.15, 0.15, 0.1, 0.1];
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < styles.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        return styles[i];
      }
    }
    
    return 'sharing';
  }

  /**
   * 生成内容变体
   */
  async generateContentVariant(
    originalContent: string,
    options: ContentVariantOptions = {}
  ): Promise<string> {
    const perspective = options.perspective || 'first';
    const structure = options.structure || 'chronological';
    const tone = options.tone || 'casual';

    const perspectivePrompt = perspective === 'first' 
      ? '使用第一人称"我"的视角，增加个人感受'
      : '使用第三人称客观叙述';

    const structurePrompt: Record<string, string> = {
      'chronological': '按时间顺序组织内容',
      'problem-solution': '先提出问题，再给出解决方案',
      'pros-cons': '先分析优点，再说明不足',
    };

    const tonePrompt: Record<string, string> = {
      'casual': '语言轻松随意，像朋友聊天',
      'formal': '语言正式专业，像官方评测',
      'enthusiastic': '语言热情洋溢，充满激情',
    };

    const systemPrompt = `你是内容改写专家。在保持原意的基础上，调整内容的叙述方式。
要求：
1. ${perspectivePrompt}
2. ${structurePrompt[structure] || structurePrompt.chronological}
3. ${tonePrompt[tone] || tonePrompt.casual}
4. 保持核心信息不变
5. 可以适当调整段落顺序和详略程度`;

    const userPrompt = `原始内容：
${originalContent}

请按照上述要求改写内容。`;

    try {
      const response = await generateContent({ systemPrompt, userPrompt });
      
      logger.info(
        `生成内容变体：视角=${perspective}, 结构=${structure}, 语气=${tone}, ` +
        `原长度=${originalContent.length}, 新长度=${response.length}`
      );

      return response;
    } catch (error) {
      logger.warn(`生成内容变体失败，使用原内容：${error instanceof Error ? error.message : String(error)}`);
      return originalContent;
    }
  }

  /**
   * 随机选择（辅助函数）
   */
  private randomSelect<T>(items: T[], count: number): T[] {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * 获取素材使用统计
   */
  async getMaterialUsageStats(topicId: string): Promise<Array<{
    path: string;
    usedCount: number;
    usageRate: number;
  }>> {
    const materialUsages = await topicUsageStorage.getMaterialStats(topicId);
    const totalUses = materialUsages.reduce((sum, u) => sum + u.usedCount, 0);

    return materialUsages.map(u => ({
      path: u.path,
      usedCount: u.usedCount,
      usageRate: totalUses > 0 ? (u.usedCount / totalUses * 100) : 0,
    })).sort((a, b) => a.usedCount - b.usedCount);
  }

  /**
   * 【新增】推荐相似主题（使用 ChromaDB）
   * @param topic 当前主题
   * @param nResults 推荐数量（默认 5）
   * @param minSimilarity 最小相似度阈值（默认 0.6）
   * @returns 推荐的主题列表
   */
  async recommendSimilarTopics(
    topic: ExtendedTopic,
    nResults: number = 5,
    minSimilarity: number = 0.6
  ): Promise<Array<{
    topicId: string;
    similarity: number;
    metadata: any;
  }>> {
    try {
      // 初始化 ChromaDB
      if (!topicRecommendStorage.isInitialized) {
        await topicRecommendStorage.initialize();
      }

      // 生成当前主题的向量
      const topicText = `${topic.title} ${topic.direction} ${topic.outline || ''}`;
      const embedding = await embeddingVectorizer.generateEmbedding(topicText);

      // 推荐相似主题
      const recommendations = await topicRecommendStorage.recommendTopics(
        embedding,
        nResults,
        minSimilarity
      );

      logger.info(
        `主题推荐：基于 "${topic.title}" 推荐 ${recommendations.length} 个主题`
      );

      return recommendations;
    } catch (error) {
      logger.warn(`主题推荐失败：${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 【新增】添加主题到 ChromaDB
   * @param topic 主题对象
   */
  async addTopicToChromaDB(topic: ExtendedTopic): Promise<void> {
    try {
        // 初始化 ChromaDB
        if (!topicRecommendStorage.isInitialized) {
          await topicRecommendStorage.initialize();
        }

      // 生成主题向量
      const topicText = `${topic.title} ${topic.direction} ${topic.outline || ''}`;
      const embedding = await embeddingVectorizer.generateEmbedding(topicText);

      // 添加到 ChromaDB
      await topicRecommendStorage.addTopicVector(
        topic.id,
        embedding,
        {
          topic_name: topic.title,
          topic_direction: topic.direction,
          topic_outline: topic.outline || '',
          tags: '',
          created_at: Date.now(),
        }
      );

      logger.debug(`主题已添加到 ChromaDB: ${topic.id}`);
    } catch (error) {
      logger.warn(`添加主题到 ChromaDB 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出单例
export const topicDiversityService = new TopicDiversityService();
