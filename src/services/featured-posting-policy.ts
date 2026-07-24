import { FeaturedPostingReadiness, FeaturedPostingMetrics } from '../types/posting-optimization';
import { getFeaturedPostingStorage } from '../storage/mysql/featured-posting-storage';

/**
 * 评估标题质量
 * @param title 标题文本
 * @returns 评估结果
 */
function evaluateTitleQuality(title: string): {
  chars: number;
  hasKeywords: boolean;
  style: string;
  eligible: boolean;
  reason?: string;
} {
  const chars = title.length;
  
  // 检查字数（10-20 字）
  const charsEligible = chars >= 10 && chars <= 20;
  
  // 检查热点关键词（简单匹配常见车型、功能词）
  const hotKeywords = ['奥迪', 'A4L', 'A6L', 'Q5', 'Q3', 'A3', 'A5', 'A7', 'A8', 'Q7', 'Q8', 'e-tron', 
                       '油耗', '保养', '改装', '驾驶', '体验', '技巧', '攻略', '分享', '实测'];
  const hasKeywords = hotKeywords.some(keyword => title.includes(keyword));
  
  // 检查吸睛句式
  let style = 'none';
  if (title.includes('如何') || title.includes('怎么') || title.includes('吗') || title.includes('?') || title.includes('？')) {
    style = 'question';
  } else if (/\d/.test(title) && (title.includes('个') || title.includes('种') || title.includes('款'))) {
    style = 'data';
  } else if (title.includes('别再') || title.includes('不要') || title.includes('避免') || title.includes('千万别')) {
    style = 'pain-point';
  }
  
  const eligible = charsEligible && hasKeywords && style !== 'none';
  const reason = !charsEligible ? `标题字数${chars}不在 10-20 字范围内` :
                 !hasKeywords ? '标题缺少热点关键词' :
                 `标题句式"${style}"不够吸睛`;
  
  return {
    chars,
    hasKeywords,
    style,
    eligible,
    reason: eligible ? undefined : reason
  };
}

/**
 * 评估内容结构
 * @param content 正文内容
 * @returns 评估结果
 */
function evaluateContentStructure(content: string): {
  hasOpening: boolean;
  hasStructure: boolean;
  hasEnding: boolean;
} {
  const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0);
  
  // 检查开头引入（提问、数据、痛点）
  const firstParagraph = paragraphs[0] || '';
  const hasOpening = 
    firstParagraph.includes('？') || firstParagraph.includes('?') || // 提问
    /\d+/.test(firstParagraph) || // 数据
    firstParagraph.includes('问题') || firstParagraph.includes('困扰') || firstParagraph.includes('烦恼'); // 痛点
  
  // 检查分段逻辑（小标题或编号列表）
  const hasStructure = 
    content.includes('#') || // 小标题标记
    /^\d+[,.]/m.test(content) || // 编号列表 1. 或 1,
    content.includes('一、') || content.includes('二、') || content.includes('三、'); // 中文编号
  
  // 检查结尾互动引导
  const lastParagraph = paragraphs[paragraphs.length - 1] || '';
  const hasEnding = 
    lastParagraph.includes('欢迎') || 
    lastParagraph.includes('分享') || 
    lastParagraph.includes('评论') ||
    lastParagraph.includes('点赞') ||
    lastParagraph.includes('收藏') ||
    lastParagraph.includes('？') || lastParagraph.includes('?');
  
  return { hasOpening, hasStructure, hasEnding };
}

/**
 * 评估图片质量
 * @param imageCount 图片数量
 * @returns 评估结果
 */
function evaluateImageQuality(imageCount: number, minImages: number): {
  quality: string;
  eligible: boolean;
  reason?: string;
} {
  const recommendedMin = 6;
  const recommendedMax = 9;
  
  if (imageCount < minImages) {
    return {
      quality: 'insufficient',
      eligible: false,
      reason: `图片数量${imageCount}少于最低要求${minImages}张`
    };
  }
  
  if (imageCount >= recommendedMin && imageCount <= recommendedMax) {
    return {
      quality: 'excellent',
      eligible: true
    };
  }
  
  if (imageCount >= minImages && imageCount < recommendedMin) {
    return {
      quality: 'acceptable',
      eligible: true,
      reason: `图片数量${imageCount}张，建议 6-9 张更有利于精华评选`
    };
  }
  
  return {
    quality: 'acceptable',
    eligible: true,
    reason: `图片数量${imageCount}张，建议控制在 6-9 张`
  };
}

export async function evaluateFeaturedPostingReadiness(params: {
  title: string;
  content: string;
  imageUrls: string[];
  topicNames?: string[];  // 话题名称列表
}): Promise<FeaturedPostingReadiness> {
  let minContentChars = 250;
  let minImages = 4;
  let maxImages = 9;
  try {
    const featuredConfig = await getFeaturedPostingStorage().getConfig();
    if (featuredConfig) {
      minContentChars = featuredConfig.minContentChars;
      minImages = featuredConfig.minImages;
      maxImages = featuredConfig.maxImages || 9;
    }
  } catch (error: any) {
    // 使用默认值
  }

  const contentChars = (params.content || '').length;
  const titleChars = (params.title || '').length;
  const topicChars = (params.topicNames || []).reduce((sum, name) => sum + name.length, 0);
  const totalChars = titleChars + contentChars + topicChars;
  
  const imageCount = Array.isArray(params.imageUrls) ? params.imageUrls.length : 0;

  const reasons: string[] = [];
  const metrics: FeaturedPostingMetrics = {
    contentChars,
    imageUrls: imageCount,
  };

  // 硬性门槛检查（汇总字数、图片数量）
  if (totalChars < minContentChars) {
    reasons.push(`汇总字数不足：${totalChars} < ${minContentChars}（标题 + 正文 + 话题）`);
  }
  if (imageCount < minImages) {
    reasons.push(`图片不足：${imageCount} < ${minImages}`);
  }
  if (imageCount > maxImages) {
    reasons.push(`图片超限：${imageCount} > ${maxImages}`);
  }

  // 多维度质量评估（软性约束，记录但不强制降级）
  
  // 1. 标题质量评估
  const titleEval = evaluateTitleQuality(params.title || '');
  metrics.titleChars = titleEval.chars;
  metrics.titleHasKeywords = titleEval.hasKeywords;
  metrics.titleStyle = titleEval.style;
  
  if (!titleEval.eligible) {
    reasons.push(`标题质量：${titleEval.reason}`);
  }

  // 2. 内容结构评估
  const structureEval = evaluateContentStructure(params.content || '');
  metrics.hasOpening = structureEval.hasOpening;
  metrics.hasStructure = structureEval.hasStructure;
  metrics.hasEnding = structureEval.hasEnding;
  
  if (!structureEval.hasOpening) {
    reasons.push('内容结构：缺少开头引入（建议用提问、数据或痛点引入）');
  }
  if (!structureEval.hasStructure) {
    reasons.push('内容结构：缺少分段逻辑（建议添加小标题或编号列表）');
  }
  if (!structureEval.hasEnding) {
    reasons.push('内容结构：缺少结尾互动引导（建议邀请评论、点赞、收藏）');
  }

  // 3. 图片质量评估
  const imageEval = evaluateImageQuality(imageCount, minImages);
  metrics.imageQuality = imageEval.quality;
  
  if (!imageEval.eligible) {
    reasons.push(`图片质量：${imageEval.reason}`);
  } else if (imageEval.reason) {
    reasons.push(`图片质量：${imageEval.reason}`);
  }

  return {
    eligible: reasons.filter((r, i) => i < 2).length === 0, // 仅硬性门槛决定 eligibility
    reasons,
    metrics,
  };
}

