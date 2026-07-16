/**
 * 抄袭检测模块
 * 
 * 通过计算生成内容与参考素材之间的文本相似度来判断是否存在抄袭。
 * 使用 N-gram 余弦相似度算法，阈值可配置。
 * 
 * 检测策略：
 * 1. 将生成内容和参考素材分别切分为 N-gram
 * 2. 计算余弦相似度
 * 3. 如果最高相似度超过阈值，判定为抄袭
 */

import { getLogger } from './logger';

const logger = getLogger('plagiarism-detector');

// 抄袭检测阈值（0-1，超过此值判定为抄袭）
const PLAGIARISM_THRESHOLD = 0.6;

// N-gram 大小
const NGRAM_SIZE = 3;

/**
 * 生成 N-gram 集合
 */
function generateNgrams(text: string, n: number): string[] {
  // 清理文本：去除标点和多余空格
  const cleaned = text
    .replace(/[，。！？、；：""''（）【】《》\s]+/g, '')
    .toLowerCase();
  
  if (cleaned.length < n) return [cleaned];
  
  const ngrams: string[] = [];
  for (let i = 0; i <= cleaned.length - n; i++) {
    ngrams.push(cleaned.substring(i, i + n));
  }
  return ngrams;
}

/**
 * 计算两个文本之间的 N-gram 余弦相似度
 */
function cosineSimilarity(text1: string, text2: string): number {
  const ngrams1 = generateNgrams(text1, NGRAM_SIZE);
  const ngrams2 = generateNgrams(text2, NGRAM_SIZE);
  
  if (ngrams1.length === 0 || ngrams2.length === 0) return 0;
  
  // 构建词频向量
  const freq1 = new Map<string, number>();
  const freq2 = new Map<string, number>();
  
  for (const ng of ngrams1) {
    freq1.set(ng, (freq1.get(ng) || 0) + 1);
  }
  for (const ng of ngrams2) {
    freq2.set(ng, (freq2.get(ng) || 0) + 1);
  }
  
  // 计算余弦相似度
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (const [ng, count] of freq1) {
    norm1 += count * count;
    if (freq2.has(ng)) {
      dotProduct += count * freq2.get(ng)!;
    }
  }
  for (const [, count] of freq2) {
    norm2 += count * count;
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * 检测连续重复片段
 * 如果生成内容中有超过指定长度的连续文本与参考完全匹配，判定为抄袭
 */
function hasLongMatch(generated: string, reference: string, minLength: number = 30): boolean {
  const cleanGenerated = generated.replace(/\s+/g, '');
  const cleanReference = reference.replace(/\s+/g, '');
  
  // 滑动窗口检查
  for (let i = 0; i <= cleanGenerated.length - minLength; i++) {
    const fragment = cleanGenerated.substring(i, i + minLength);
    if (cleanReference.includes(fragment)) {
      return true;
    }
  }
  return false;
}

/**
 * 检测生成内容是否与参考素材存在抄袭
 * 
 * @param generatedContent 生成的帖子内容
 * @param references 参考素材列表（SearchResult 格式）
 * @returns true 表示存在抄袭嫌疑，false 表示通过
 */
export function detectPlagiarism(
  generatedContent: string, 
  references: Array<{ title?: string; content?: string; [key: string]: any }>
): boolean {
  if (!generatedContent || !references || references.length === 0) {
    return false;
  }

  try {
    let maxSimilarity = 0;
    let matchedSource = '';

    for (const ref of references) {
      const refContent = ref.content || ref.title || '';
      if (!refContent || refContent.length < 20) continue;
      
      // 1. 余弦相似度检测
      const similarity = cosineSimilarity(generatedContent, refContent);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        matchedSource = ref.title || ref.content?.substring(0, 50) || '未知来源';
      }
      
      // 2. 连续重复片段检测（30 字以上完全匹配）
      if (hasLongMatch(generatedContent, refContent, 30)) {
        logger.warn(
          `抄袭检测：发现 30 字以上连续匹配，来源："${ref.title || '未知'}"，` +
          `判定为抄袭`
        );
        return true;
      }
    }

    if (maxSimilarity >= PLAGIARISM_THRESHOLD) {
      logger.warn(
        `抄袭检测：最高相似度 ${(maxSimilarity * 100).toFixed(1)}% >= 阈值 ${PLAGIARISM_THRESHOLD * 100}%，` +
        `匹配来源："${matchedSource}"，判定为抄袭`
      );
      return true;
    }

    logger.info(
      `抄袭检测通过：最高相似度 ${(maxSimilarity * 100).toFixed(1)}% < 阈值 ${PLAGIARISM_THRESHOLD * 100}%`
    );
    return false;
  } catch (error) {
    logger.error('抄袭检测异常:', error instanceof Error ? error.message : String(error));
    // 异常时不阻止发帖
    return false;
  }
}
