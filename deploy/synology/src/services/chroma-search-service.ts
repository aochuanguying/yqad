/**
 * ChromaDB 搜索服务
 * 
 * 功能：
 * 1. 素材语义搜索
 * 2. 内容去重检测
 * 3. 主题推荐
 * 4. 相似度查询
 * 
 * 使用场景：
 * - 根据描述搜索相似素材
 * - 检测发帖内容是否重复
 * - 推荐相关主题
 */

import { materialVectorStorage } from '../storage/chroma/material-vector-storage';
import { contentDedupStorage } from '../storage/chroma/content-dedup-storage';
import { topicRecommendStorage } from '../storage/chroma/topic-recommend-storage';
import { embeddingVectorizer, batchGenerateEmbeddings } from '../utils/embedding-vectorizer';
import { getLogger } from '../utils/logger';

const logger = getLogger('chroma-search');

/**
 * 素材搜索选项
 */
export interface MaterialSearchOptions {
  /** 搜索查询文本 */
  query: string;
  /** 返回结果数量（默认 10） */
  nResults?: number;
  /** 最小相似度阈值（默认 0.7） */
  minSimilarity?: number;
  /** 过滤条件 */
  filters?: {
    /** 文件类型 */
    fileType?: 'image' | 'text' | 'video';
    /** 位置 */
    location?: string;
  };
}

/**
 * 素材搜索结果
 */
export interface MaterialSearchResult {
  /** 素材 ID */
  id: string;
  /** 文件路径 */
  filePath: string;
  /** 文件名称 */
  fileName: string;
  /** 相似度分数 */
  similarity: number;
  /** 描述 */
  description?: string;
  /** 标签 */
  tags?: string[];
}

/**
 * 内容去重检测结果
 */
export interface DuplicateCheckResult {
  /** 是否重复 */
  isDuplicate: boolean;
  /** 最高相似度 */
  maxSimilarity: number;
  /** 匹配的帖子 ID */
  matchedPostId?: string;
  /** 匹配的帖子标题 */
  matchedTitle?: string;
}

/**
 * 主题推荐选项
 */
export interface TopicRecommendOptions {
  /** 参考文本（标题 + 提纲） */
  referenceText: string;
  /** 返回推荐数量（默认 5） */
  nResults?: number;
  /** 最小相似度阈值（默认 0.6） */
  minSimilarity?: number;
}

/**
 * 主题推荐结果
 */
export interface TopicRecommendResult {
  /** 主题 ID */
  topicId: string;
  /** 主题名称 */
  topicName: string;
  /** 相似度分数 */
  similarity: number;
}

/**
 * ChromaDB 搜索服务类
 */
class ChromaSearchService {
  /**
   * 语义搜索素材
   * @param options 搜索选项
   * @returns 搜索结果
   */
  async searchMaterials(options: MaterialSearchOptions): Promise<MaterialSearchResult[]> {
    try {
      logger.info(`开始语义搜索素材：${options.query}`);
      
      // 1. 生成查询向量
      const queryEmbedding = await embeddingVectorizer.generateEmbedding(options.query);
      
      // 2. ChromaDB 相似度搜索
      const chromaResults = await materialVectorStorage.searchSimilar(
        queryEmbedding,
        { 
          nResults: options.nResults || 10,
          where: options.filters ? this.buildMaterialFilters(options.filters) : undefined,
        }
      );
      
      // 3. 过滤低相似度结果
      const minSimilarity = options.minSimilarity || 0.7;
      const filteredResults = chromaResults
        .filter(r => r.similarity >= minSimilarity)
        .map(r => ({
          id: r.id.replace(/^material_/, ''),
          filePath: r.metadata.file_path,
          fileName: r.metadata.file_name || '',
          similarity: r.similarity,
          description: r.metadata.description,
          tags: r.metadata.tags ? this.parseTags(r.metadata.tags) : undefined,
        }));
      
      logger.info(`素材语义搜索完成：找到 ${filteredResults.length} 个结果（阈值：${minSimilarity}）`);
      
      return filteredResults;
    } catch (error) {
      logger.error('素材语义搜索失败:', error);
      return [];
    }
  }

  /**
   * 检查内容重复
   * @param title 帖子标题
   * @param content 帖子内容
   * @returns 去重检测结果
   */
  async checkContentDuplicate(
    title: string, 
    content: string
  ): Promise<DuplicateCheckResult> {
    try {
      const text = `${title} ${content}`;
      const queryEmbedding = await embeddingVectorizer.generateEmbedding(text);
      
      // 使用 content-dedup Collection 搜索
      const results = await contentDedupStorage.searchSimilar(
        queryEmbedding,
        5
      );
      
      // 计算最高相似度
      const maxSimilarity = results.length > 0 
        ? Math.max(...results.map(r => r.similarity)) 
        : 0;
      
      // 判断是否重复（阈值 0.85）
      const isDuplicate = maxSimilarity >= 0.85;
      
      logger.info(
        `内容去重检测：${isDuplicate ? '重复' : '通过'} ` +
        `(相似度：${maxSimilarity.toFixed(3)}, 标题："${title}")`
      );
      
      return {
        isDuplicate,
        maxSimilarity,
        matchedPostId: results[0]?.id,
        matchedTitle: results[0]?.metadata?.title,
      };
    } catch (error) {
      logger.error('内容去重检测失败:', error);
      return {
        isDuplicate: false,
        maxSimilarity: 0,
      };
    }
  }

  /**
   * 推荐相似主题
   * @param options 推荐选项
   * @returns 推荐结果
   */
  async recommendTopics(options: TopicRecommendOptions): Promise<TopicRecommendResult[]> {
    try {
      logger.info(`开始主题推荐：${options.referenceText.substring(0, 50)}...`);
      
      // 1. 生成查询向量
      const queryEmbedding = await embeddingVectorizer.generateEmbedding(options.referenceText);
      
      // 2. 使用 topic-recommend Collection 搜索
      const recommendations = await topicRecommendStorage.recommendTopics(
        queryEmbedding,
        options.nResults || 5,
        options.minSimilarity || 0.6
      );
      
      // 3. 转换为 TopicRecommendResult
      const results = recommendations.map(r => ({
        topicId: r.topicId,
        topicName: r.metadata.topic_name,
        similarity: r.similarity,
      }));
      
      logger.info(`主题推荐完成：找到 ${results.length} 个推荐`);
      
      return results;
    } catch (error) {
      logger.error('主题推荐失败:', error);
      return [];
    }
  }

  /**
   * 批量生成素材向量（用于初始化）
   * @param materials 素材数组
   */
  async batchGenerateMaterialVectors(
    materials: Array<{
      id: string;
      fileName: string;
      description?: string;
      tags?: any;
    }>
  ): Promise<void> {
    try {
      logger.info(`批量生成 ${materials.length} 个素材向量...`);
      
      // 构建文本
      const texts = materials.map(m => 
        `${m.fileName} ${m.description || ''} ${m.tags ? JSON.stringify(m.tags) : ''}`.trim()
      );
      
      // 批量生成向量
      const embeddings = await batchGenerateEmbeddings(texts, 10);
      
      // 添加到 ChromaDB
      const ids = materials.map(m => `material_${m.id}`);
      const metadatas = materials.map(m => ({
        file_path: (m as any).filePath || (m as any).path || '',
        file_name: m.fileName,
        description: m.description || '',
        tags: m.tags ? JSON.stringify(m.tags) : '',
      }));
      
      await materialVectorStorage.addVectors(ids, embeddings, metadatas as any);
      
      logger.info(`✅ 批量生成素材向量完成：${materials.length}个`);
    } catch (error) {
      logger.error('批量生成素材向量失败:', error);
      throw error;
    }
  }

  /**
   * 构建过滤条件
   */
  private buildMaterialFilters(filters: MaterialSearchOptions['filters'] | undefined): Record<string, any> {
    const where: Record<string, any> = {};
    
    if (!filters) {
      return where;
    }
    
    if (filters.fileType) {
      where.file_type = filters.fileType;
    }
    
    if (filters.location) {
      where.location = filters.location;
    }
    
    return where;
  }

  /**
   * 解析标签（从 JSON 字符串或数组）
   */
  private parseTags(tags: any): string[] {
    if (!tags) return [];
    
    if (Array.isArray(tags)) {
      return tags;
    }
    
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [tags];
    }
  }
}

// 导出单例
export const chromaSearchService = new ChromaSearchService();

// 导出便捷函数
export async function searchMaterials(options: MaterialSearchOptions): Promise<MaterialSearchResult[]> {
  return chromaSearchService.searchMaterials(options);
}

export async function checkContentDuplicate(
  title: string, 
  content: string
): Promise<DuplicateCheckResult> {
  return chromaSearchService.checkContentDuplicate(title, content);
}

export async function recommendTopics(options: TopicRecommendOptions): Promise<TopicRecommendResult[]> {
  return chromaSearchService.recommendTopics(options);
}
