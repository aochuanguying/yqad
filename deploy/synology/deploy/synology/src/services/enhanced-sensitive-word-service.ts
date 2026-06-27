/**
 * 增强敏感词检测服务
 * 
 * 功能：
 * 1. 整合 Redis 精确匹配（快速）和 ChromaDB 语义匹配（检测变体）
 * 2. 两级检测机制：
 *    - 第一级：Redis Trie 树精确匹配（毫秒级）
 *    - 第二级：ChromaDB 语义匹配（检测同义词、变体词）
 * 3. 支持分级处理：禁止/替换/警告
 * 4. 支持变体词识别（如"加微信" → "加薇"）
 * 
 * 技术栈：
 * - Redis: 精确匹配敏感词
 * - ChromaDB: 语义匹配敏感词变体
 */

import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { sensitiveWordFilterService, SensitiveWordDetectionResult, SensitiveWordLevel } from './sensitive-word-filter-service';
import { sensitiveVariantStorage, VariantDetectionResult } from '../storage/chroma/sensitive-variant-storage';
import { embeddingVectorizer } from '../utils/embedding-vectorizer';

const logger = getLogger('enhanced-sensitive-word-service');

/**
 * 增强检测结果
 */
export interface EnhancedDetectionResult {
  /** 是否通过检测 */
  passed: boolean;
  /** Redis 精确匹配结果 */
  exactMatch?: SensitiveWordDetectionResult;
  /** ChromaDB 语义匹配结果 */
  semanticMatch?: VariantDetectionResult;
  /** 拒绝原因 */
  rejectReason?: string;
  /** 过滤后的文本 */
  filteredText?: string;
}

/**
 * 增强敏感词检测服务类
 */
class EnhancedSensitiveWordService {
  /**
   * 检测并替换敏感词（两级检测）
   * @param text 待检测文本
   * @returns 检测结果
   */
  async detectAndReplace(text: string): Promise<EnhancedDetectionResult> {
    const config = loadConfig();
    
    // 如果敏感词过滤被禁用，直接通过
    if (config.sensitiveWordFilter?.enabled === false) {
      logger.debug('敏感词过滤已禁用');
      return { passed: true };
    }

    try {
      // ========== 第一级：Redis 精确匹配 ==========
      logger.debug(`开始第一级检测（Redis 精确匹配）："${text.substring(0, 20)}..."`);
      const exactMatchResult = await sensitiveWordFilterService.detectAndReplace(text);
      
      // 如果精确匹配发现禁止类词汇，直接拒绝
      if (exactMatchResult.shouldReject) {
        logger.warn(`精确匹配检测到禁止类词汇：${exactMatchResult.detection.rejectReason}`);
        return {
          passed: false,
          exactMatch: exactMatchResult.detection,
          rejectReason: exactMatchResult.detection.rejectReason,
          filteredText: text,
        };
      }

      // ========== 第二级：ChromaDB 语义匹配 ==========
      logger.debug(`开始第二级检测（ChromaDB 语义匹配）："${text.substring(0, 20)}..."`);
      
      let semanticMatchResult: VariantDetectionResult | undefined;
      
      try {
        // 确保存储已初始化
        if (!sensitiveVariantStorage.isInitialized) {
          await sensitiveVariantStorage.initialize();
        }
        
        // 生成文本向量
        const embedding = await embeddingVectorizer.generateEmbedding(text);
        
        // 语义匹配检测（阈值 0.85）
        semanticMatchResult = await sensitiveVariantStorage.detectVariant(
          text,
          embedding,
          3,      // 返回 3 个最相似的结果
          0.85    // 相似度阈值 85%
        );
        
        // 如果检测到变体词
        if (semanticMatchResult.isVariant) {
          logger.warn(
            `语义匹配检测到敏感词变体："${text}" -> "${semanticMatchResult.matchedWord}" ` +
            `(相似度：${(semanticMatchResult.maxSimilarity * 100).toFixed(1)}%, ` +
            `分类：${semanticMatchResult.category || '未知'})`
          );
          
          return {
            passed: false,
            exactMatch: exactMatchResult.detection,
            semanticMatch: semanticMatchResult,
            rejectReason: `检测到敏感词变体："${semanticMatchResult.matchedWord}" ` +
              `(相似度：${(semanticMatchResult.maxSimilarity * 100).toFixed(1)}%, ` +
              `分类：${semanticMatchResult.category || '未知'})`,
            filteredText: text,
          };
        }
      } catch (error) {
        // 语义匹配失败不影响主流程，仅记录警告
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn(`ChromaDB 语义匹配失败，跳过：${errorMsg}`);
      }

      // ========== 两级检测都通过 ==========
      logger.debug('两级敏感词检测通过');
      
      return {
        passed: true,
        exactMatch: exactMatchResult.detection,
        semanticMatch: semanticMatchResult,
        filteredText: exactMatchResult.filteredText,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`增强敏感词检测失败：${errorMsg}`);
      
      // 检测失败时的降级策略：仅记录警告，不拒绝
      return {
        passed: true,
        rejectReason: `敏感词检测异常：${errorMsg}`,
        filteredText: text,
      };
    }
  }

  /**
   * 批量检测文本
   * @param texts 文本数组
   * @returns 检测结果数组
   */
  async batchDetectAndReplace(texts: string[]): Promise<EnhancedDetectionResult[]> {
    return Promise.all(texts.map(text => this.detectAndReplace(text)));
  }

  /**
   * 仅精确匹配（快速模式）
   * @param text 待检测文本
   * @returns 检测结果
   */
  async quickDetect(text: string): Promise<SensitiveWordDetectionResult> {
    return await sensitiveWordFilterService.detectSensitiveWords(text);
  }

  /**
   * 仅语义匹配（深度模式）
   * @param text 待检测文本
   * @returns 语义匹配结果
   */
  async semanticDetect(text: string): Promise<VariantDetectionResult | undefined> {
    try {
      if (!sensitiveVariantStorage.isInitialized) {
        await sensitiveVariantStorage.initialize();
      }
      
      const embedding = await embeddingVectorizer.generateEmbedding(text);
      return await sensitiveVariantStorage.detectVariant(text, embedding, 3, 0.85);
    } catch (error) {
      logger.warn(`语义检测失败：${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  /**
   * 添加敏感词到两个存储
   * @param word 敏感词
   * @param level 级别
   * @param replacement 替换词
   */
  async addSensitiveWord(
    word: string,
    level: SensitiveWordLevel,
    replacement?: string
  ): Promise<void> {
    // 1. 添加到 Redis（精确匹配）
    await sensitiveWordFilterService.addWord(word, level, replacement);
    
    // 2. 添加到 ChromaDB（语义匹配）
    try {
      if (!sensitiveVariantStorage.isInitialized) {
        await sensitiveVariantStorage.initialize();
      }
      
      const embedding = await embeddingVectorizer.generateEmbedding(word);
      await sensitiveVariantStorage.addSensitiveWordVector(
        `word_${Date.now()}`,
        embedding,
        {
          word_text: word,
          category: level,
          severity: level === SensitiveWordLevel.FORBIDDEN ? 5 : 3,
          replacement: replacement,
          created_at: Date.now(),
        }
      );
      
      logger.info(`添加敏感词到双存储：${word}`);
    } catch (error) {
      logger.warn(`添加到 ChromaDB 失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取检测统计
   */
  async getDetectionStats(): Promise<{
    exactMatchCount: number;
    semanticMatchCount: number;
    totalWords: number;
  }> {
    let semanticMatchCount = 0;
    
    try {
      if (sensitiveVariantStorage.isInitialized) {
        semanticMatchCount = await sensitiveVariantStorage.count();
      }
    } catch (error) {
      logger.warn(`获取语义匹配统计失败：${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      exactMatchCount: 0, // Redis 统计需要额外接口
      semanticMatchCount,
      totalWords: semanticMatchCount,
    };
  }
}

// 导出单例
export const enhancedSensitiveWordService = new EnhancedSensitiveWordService();
