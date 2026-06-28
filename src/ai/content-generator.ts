import { generateContent } from './client';
import { buildCommentSystemPrompt, buildCommentUserPrompt, buildPostSystemPrompt, buildPostUserPrompt, buildFeaturedPostUserPrompt, buildHumanToneCommentPrompt } from './prompts';
import { PostFeatures } from '../services/comment-analyzer';
import { PostGenerationOptions } from '../types/posting-optimization';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { getContentLimitsStorage } from '../storage/mysql/content-limits-storage';
import { ReferencePost as InternetReference } from '../types/posting-optimization';

const logger = getLogger('content-gen');

/**
 * 任务 3.1: 提示词构建器接口
 */
export interface IPromptBuilder {
  build(topic: string, references?: InternetReference[]): { systemPrompt: string; userPrompt: string };
}

/**
 * 任务 3.2: 小红书风格提示词构建器
 */
export class XiaohongshuPromptBuilder implements IPromptBuilder {
  build(topic: string, references?: InternetReference[]): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `你是小红书汽车博主，擅长分享真实用车体验。

内容要求：
1. 标题：[emoji] 核心卖点 + 情绪表达（20-30 字）
   示例：🚗 奥迪 Q5L 真香！上下班通勤太舒服了

2. 正文结构：
   - 个人情况（车型、配置、购车时间）
   - 使用场景（上下班/接送孩子/自驾游）
   - 优点列举（3-5 点，配 emoji）
   - 小缺点（增加真实性）
   - 总结推荐

3. 语言风格：
   - 口语化、生活化
   - 使用 emoji（每段 1-2 个）
   - 情绪化表达（真香、绝绝子、踩雷）
   - 分段清晰，每段 1-3 句

4. 标签：3-5 个相关标签
   示例：#奥迪 Q5L #豪华 SUV #用车日常 #真香分享

5. 字数：100-500 字`;

    const userPrompt = `主题：${topic}
${references && references.length > 0 ? `参考素材：${references.map(r => r.content).join('\n')}` : ''}

请基于以上要求，生成一篇小红书风格的奥迪用车分享。`;

    return { systemPrompt, userPrompt };
  }
}

/**
 * 任务 3.3: 知乎风格提示词构建器
 */
export class ZhihuPromptBuilder implements IPromptBuilder {
  build(topic: string, references?: InternetReference[]): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `你是知乎汽车领域优秀答主，擅长深度分析和技术解读。

内容要求：
1. 标题：问题形式或深度分析（30-50 字）
   示例：如何评价奥迪 Q5L 的油耗表现？真实车主 3 万公里深度分享

2. 正文结构：
   - 背景介绍（市场定位、竞品分析）
   - 技术参数对比（表格、数据）
   - 实际体验（驾驶感受、空间表现）
   - 优缺点分析（客观中立）
   - 购买建议（适合人群、配置推荐）
   - 总结

3. 语言风格：
   - 专业术语、数据分析
   - 逻辑清晰、论证充分
   - 客观中立、不偏不倚
   - 引用来源、案例支撑

4. 内容深度：
   - 至少包含 3 个维度的分析
   - 提供具体数据支撑
   - 对比竞品车型
   - 给出专业建议

5. 字数：800-2000 字`;

    const userPrompt = `主题：${topic}
${references && references.length > 0 ? `参考素材：${references.map(r => r.content).join('\n')}` : ''}

请基于以上要求，生成一篇知乎风格的奥迪深度分析。`;

    return { systemPrompt, userPrompt };
  }
}

/**
 * 任务 3.4: 汽车之家风格提示词构建器
 */
export class AutohomePromptBuilder implements IPromptBuilder {
  build(topic: string, references?: InternetReference[]): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `你是汽车之家认证车主，擅长分享真实用车体验和改装案例。

内容要求：
1. 标题：【分类】核心内容 + 关键信息（25-40 字）
   示例：【提车作业】奥迪 Q5L 45TFSI 豪华型，落地价 35 万，坐标上海

2. 正文结构：
   - 购车背景（为什么选这款车）
   - 对比过程（看过哪些竞品）
   - 价格明细（裸车、保险、购置税、落地价）
   - 初体验（外观、内饰、空间）
   - 驾驶感受（动力、操控、油耗）
   - 总结推荐

3. 语言风格：
   - 真实车主口吻
   - 具体数据支撑
   - 客观评价优缺点
   - 实用建议

4. 内容重点：
   - 价格信息（裸车价、落地价）
   - 配置选择理由
   - 真实油耗数据
   - 改装/装饰建议

5. 字数：500-1500 字`;

    const userPrompt = `主题：${topic}
${references && references.length > 0 ? `参考素材：${references.map(r => r.content).join('\n')}` : ''}

请基于以上要求，生成一篇汽车之家风格的奥迪车主分享。`;

    return { systemPrompt, userPrompt };
  }
}

/**
 * 任务 3.5: 根据参考素材来源选择提示词风格
 */
export function selectPromptBuilder(references?: InternetReference[]): IPromptBuilder {
  if (!references || references.length === 0) {
    // 默认使用小红书风格
    return new XiaohongshuPromptBuilder();
  }

  // 统计参考素材来源
  const platformCount = {
    xiaohongshu: 0,
    zhihu: 0,
    autohome: 0,
  };

  for (const ref of references) {
    if (ref.source.includes('小红书')) platformCount.xiaohongshu++;
    else if (ref.source.includes('知乎')) platformCount.zhihu++;
    else if (ref.source.includes('汽车之家')) platformCount.autohome++;
  }

  // 选择占比最高的平台风格（平局时优先选择小红书）
  let maxPlatform = 'xiaohongshu';
  let maxCount = 0;
  
  // 按优先级顺序检查：小红书 > 知乎 > 汽车之家
  if (platformCount.xiaohongshu > maxCount) {
    maxCount = platformCount.xiaohongshu;
    maxPlatform = 'xiaohongshu';
  }
  if (platformCount.zhihu > maxCount) {
    maxCount = platformCount.zhihu;
    maxPlatform = 'zhihu';
  }
  if (platformCount.autohome > maxCount) {
    maxCount = platformCount.autohome;
    maxPlatform = 'autohome';
  }

  logger.debug(`选择提示词风格：${maxPlatform} (小红书:${platformCount.xiaohongshu}, 知乎:${platformCount.zhihu}, 汽车之家:${platformCount.autohome})`);

  switch (maxPlatform) {
    case 'xiaohongshu':
      return new XiaohongshuPromptBuilder();
    case 'zhihu':
      return new ZhihuPromptBuilder();
    case 'autohome':
      return new AutohomePromptBuilder();
    default:
      return new XiaohongshuPromptBuilder();
  }
}

/**
 * 任务 3.8: 内容适配性检查
 */
function checkPlatformAdaptability(content: string, platform: string): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  switch (platform) {
    case 'xiaohongshu':
      // 检查 emoji 数量
      const emojiCount = (content.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
      if (emojiCount < 3) {
        issues.push(`emoji 数量不足（当前${emojiCount}个，建议至少 3 个）`);
        score -= 20;
      }

      // 检查段落长度
      const paragraphs = content.split('\n').filter(p => p.trim().length > 0);
      const longParagraphs = paragraphs.filter(p => p.split(/[。！？]/).length > 4);
      if (longParagraphs.length > 0) {
        issues.push(`段落过长，建议每段 1-3 句`);
        score -= 15;
      }

      // 检查情绪化表达
      const emotionKeywords = ['真香', '绝绝子', '踩雷', '太舒服了', '真的很', '超级'];
      const hasEmotion = emotionKeywords.some(k => content.includes(k));
      if (!hasEmotion) {
        issues.push(`缺少情绪化表达，建议添加真香、绝绝子等`);
        score -= 15;
      }
      break;

    case 'zhihu':
      // 检查专业术语
      const professionalKeywords = ['油耗', '动力', '操控', '空间', '配置', '对比', '分析'];
      const profCount = professionalKeywords.filter(k => content.includes(k)).length;
      if (profCount < 3) {
        issues.push(`专业术语不足，建议添加更多技术分析`);
        score -= 20;
      }

      // 检查数据支撑
      const hasNumbers = /\d+(\.\d+)?/.test(content);
      if (!hasNumbers) {
        issues.push(`缺少数据支撑，建议添加具体数字`);
        score -= 20;
      }

      // 检查逻辑结构
      const hasStructure = content.includes('首先') || content.includes('其次') || 
                          content.includes('最后') || content.includes('总结');
      if (!hasStructure) {
        issues.push(`缺少逻辑分层，建议添加首先、其次、总结等`);
        score -= 10;
      }
      break;

    case 'autohome':
      // 检查配置信息
      const configKeywords = ['配置', '型', 'TFSI', 'quattro', '豪华', '动感'];
      const hasConfig = configKeywords.some(k => content.includes(k));
      if (!hasConfig) {
        issues.push(`缺少具体配置信息`);
        score -= 20;
      }

      // 检查价格信息
      const hasPrice = /\d+ 万|\d+ 元/.test(content);
      if (!hasPrice) {
        issues.push(`缺少价格信息，建议添加落地价、裸车价等`);
        score -= 20;
      }

      // 检查车主口吻
      const ownerKeywords = ['我', '我的', '本人', '车主', '提车', '购买'];
      const hasOwner = ownerKeywords.some(k => content.includes(k));
      if (!hasOwner) {
        issues.push(`缺少真实车主口吻`);
        score -= 10;
      }
      break;
  }

  return { score: Math.max(0, score), issues };
}

export interface GeneratedComment {
  content: string;
}

export interface GeneratedPost {
  title: string;
  content: string;
}

export interface CommentGenerationOptions {
  previousComment?: string;    // 兜底模式下上次的评论内容
  batchIndex?: number;         // 当前批次中的序号（0-based）
  recentOpenings?: string[];   // 最近 avoidRepeatDays 天内的评论开头
}

/**
 * 生成评论内容，带长度约束和拟人化策略
 */
export async function generateComment(
  features: PostFeatures,
  options?: {
    previousComment?: string;
    batchIndex?: number;
    recentOpenings?: string[];
  }
): Promise<GeneratedComment> {
  // 从数据库获取内容限制配置
  let min = 5;
  let max = 20;
  try {
    const limitsConfig = await getContentLimitsStorage().getConfig();
    if (limitsConfig) {
      min = limitsConfig.comment.min;
      max = limitsConfig.comment.max;
    }
  } catch (error: any) {
    logger.warn(`获取内容限制配置失败，使用默认值：${error.message}`);
  }

  // 使用拟人化 prompt 策略
  const useColloquial = Math.random() < 0.3;
  const { systemPrompt, userPrompt } = buildHumanToneCommentPrompt(features, {
    previousComment: options?.previousComment,
    batchIndex: options?.batchIndex,
    recentOpenings: options?.recentOpenings,
    useColloquial,
  });

  let content = await generateContent({ systemPrompt, userPrompt, scene: 'comment' });

  // 长度约束
  content = enforceLength(content, min, max);

  logger.info(`生成评论 (${content.length}字) 针对帖子：${features.post.title}`);
  return { content };
}

/**
 * 生成帖子内容，带长度约束
 */
export async function generatePost(
  topic: string,
  avoidTopics: string[],
  summary: undefined, // 已移除社区分析摘要
  topicConstraint?: string,
  options?: PostGenerationOptions
): Promise<GeneratedPost> {
  const config = loadConfig();
  const mode = options?.mode ?? 'normal';
  
  // 从数据库获取内容限制配置
  let min = 100;
  let max = 480;
  try {
    const limitsConfig = await getContentLimitsStorage().getConfig();
    if (limitsConfig) {
      min = limitsConfig.post.min;
      max = limitsConfig.post.max;
    }
  } catch (error: any) {
    logger.warn(`获取内容限制配置失败，使用默认值：${error.message}`);
  }

  if (mode === 'featured') {
    min = Math.max(min, config.featuredPosting.minContentChars);
    max = Math.max(max, min);
  }

  // 严格控制最大长度：预留标题和换行的空间（标题平均 30 字 + 2 换行）
  const maxBodyLength = max - 32;

  // 任务 3.6: 如果有参考素材，使用分平台提示词生成逻辑
  if (options?.references && options.references.length > 0) {
    logger.info(`使用分平台提示词生成，参考素材数：${options.references.length}`);
    
    // 任务 3.5: 根据参考素材来源选择提示词风格
    const promptBuilder = selectPromptBuilder(options.references);
    const { systemPrompt, userPrompt } = promptBuilder.build(topic, options.references);
    
    const rawContent = await generateContent({ systemPrompt, userPrompt, scene: 'post' });
    
    // 解析标题和正文
    const lines = rawContent.split('\n');
    const title = lines[0].replace(/^[#\s]+/, '').trim();
    const body = lines.slice(1).join('\n').trim();
    
    // 正文长度约束
    const content = enforceLength(body, min, maxBodyLength);
    
    // 任务 3.8: 内容适配性检查
    const dominantPlatform = getDominantPlatform(options.references);
    const adaptability = checkPlatformAdaptability(content, dominantPlatform);
    
    if (adaptability.score < 60) {
      logger.warn(`内容适配性评分较低 (${adaptability.score}分): ${adaptability.issues.join(', ')}`);
    } else {
      logger.info(`内容适配性评分：${adaptability.score}分`);
    }
    
    logger.info(`生成帖子（分平台风格）："${title}" (正文${content.length}字)`);
    return { title, content };
  }

  // 传统生成逻辑（无参考素材时使用）
  // 如果有 topicConstraint，说明使用了子方向，需要解析并传递给 buildPostSystemPrompt
  let subDirection: { title: string; direction: string; outline: string } | undefined;
  if (topicConstraint) {
    // topicConstraint 格式："子方向：xxx\n内容提纲：xxx" 或 "主题方向：xxx\n内容提纲：xxx"
    const isSubDirection = topicConstraint.startsWith('子方向：');
    if (isSubDirection) {
      const lines = topicConstraint.split('\n');
      const direction = lines[0].replace('子方向：', '').trim();
      const outlineMatch = lines.find(l => l.startsWith('内容提纲：'));
      const outline = outlineMatch ? outlineMatch.replace('内容提纲：', '').trim() : '';
      subDirection = { title: topic, direction, outline };
    }
  }

  const systemPrompt = buildPostSystemPrompt(
    summary,
    options?.globalPrompt,
    options?.topicHistory,
    subDirection,
    true  // isTitleReference = true，标题仅供参考
  );
  const userPrompt = topicConstraint
    ? buildTopicConstraintPrompt(topicConstraint, avoidTopics, mode, min, maxBodyLength)
    : mode === 'featured'
      ? buildFeaturedPostUserPrompt(topic, avoidTopics, min, maxBodyLength)
      : buildPostUserPrompt(topic, avoidTopics, maxBodyLength);

  const rawContent = await generateContent({ systemPrompt, userPrompt, scene: 'post' });

  // 解析标题和正文
  const lines = rawContent.split('\n');
  const title = lines[0].replace(/^[#\s]+/, '').trim();
  const body = lines.slice(1).join('\n').trim();

  // 正文长度约束（严格控制，确保总长度不超过 API 限制）
  const content = enforceLength(body, min, maxBodyLength);

  logger.info(`生成帖子："${title}" (正文${content.length}字，总计约${title.length + content.length + 2}字)`);
  return { title, content };
}

/**
 * 获取参考素材中占比最高的平台
 */
function getDominantPlatform(references: InternetReference[]): string {
  const platformCount = {
    xiaohongshu: 0,
    zhihu: 0,
    autohome: 0,
  };

  for (const ref of references) {
    if (ref.source.includes('小红书')) platformCount.xiaohongshu++;
    else if (ref.source.includes('知乎')) platformCount.zhihu++;
    else if (ref.source.includes('汽车之家')) platformCount.autohome++;
  }

  const maxPlatform = Object.keys(platformCount).reduce(
    (a, b) => platformCount[a as keyof typeof platformCount] > platformCount[b as keyof typeof platformCount] ? a : b
  );

  return maxPlatform;
}

function buildTopicConstraintPrompt(topicConstraint: string, avoidTopics: string[], mode: string, minContentChars: number, maxBodyLength?: number): string {
  let prompt = `${topicConstraint}\n\n请基于以上主题方向和提纲生成帖子。`;
  if (avoidTopics.length > 0) {
    prompt += `避免以下已发布话题：${avoidTopics.join('、')}`;
  }
  if (mode === 'featured') {
    const maxLengthConstraint = maxBodyLength ? `，最多 ${maxBodyLength} 字` : '';
    prompt += `\n\n硬性要求：\n- 正文 ${minContentChars}-${maxBodyLength || '800'} 字${maxLengthConstraint}\n- 排版清晰分层：至少 4 段，每段 1-3 句，包含小标题或编号\n- 内容真实、原创、逻辑清晰，围绕奥迪选车/购车/用车/保养/售后/精品等相关内容展开`;
  }
  return prompt;
}

/**
 * 强制内容长度在指定范围内
 */
function enforceLength(text: string, min: number, max: number): string {
  if (text.length > max) {
    // 截断到 [min, max] 范围内的最近完整句子或短语
    const truncated = text.substring(0, max);
    
    // 优先级 1: 找句号、感叹号、问号（确保截取后长度 >= min）
    const lastPeriod = Math.max(
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('？')
    );
    
    if (lastPeriod + 1 >= min) {  // +1 是因为 substring 不包含结束位置
      return truncated.substring(0, lastPeriod + 1);
    }
    
    // 优先级 2: 找逗号、分号、顿号（确保截取后长度 >= min）
    const lastComma = Math.max(
      truncated.lastIndexOf('，'),
      truncated.lastIndexOf('；'),
      truncated.lastIndexOf('、')
    );
    
    if (lastComma + 1 >= min) {
      return truncated.substring(0, lastComma + 1);
    }
    
    // 优先级 3: 找空格或换行（确保截取后长度 >= min）
    const lastSpace = Math.max(
      truncated.lastIndexOf(' '),
      truncated.lastIndexOf('\n')
    );
    
    if (lastSpace >= min) {
      return truncated.substring(0, lastSpace);
    }
    
    // 最后方案：如果找不到合适的断点，直接截断到 max 并添加省略号
    // 如果 max < min，优先保证不超过 max
    if (max >= min) {
      return truncated.substring(0, max - 2) + '...';
    } else {
      // 极端情况：max < min，返回 max 长度的内容
      return truncated.substring(0, max);
    }
  }

  if (text.length < min) {
    logger.warn(`生成内容过短 (${text.length}字 < ${min}字)，将使用原文`);
  }

  return text;
}
