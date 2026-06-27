import { generateContent } from './client';
import { buildCommentSystemPrompt, buildCommentUserPrompt, buildPostSystemPrompt, buildPostUserPrompt, buildFeaturedPostUserPrompt, buildHumanToneCommentPrompt } from './prompts';
import { PostFeatures } from '../services/comment-analyzer';
import { PostGenerationOptions } from '../types/posting-optimization';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

const logger = getLogger('content-gen');

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
  const config = loadConfig();
  const { min, max } = config.contentLimits.comment;

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
  let min = config.contentLimits.post.min;
  let max = config.contentLimits.post.max;

  if (mode === 'featured') {
    min = Math.max(min, config.featuredPosting.minContentChars);
    max = Math.max(max, min);
  }

  // 严格控制最大长度：预留标题和换行的空间（标题平均 30 字 + 2 换行）
  const maxBodyLength = max - 32;

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
