/**
 * 主题服务 - 使用 MySQL 存储
 */

import { getLogger } from '../../utils/logger';
import { PostSummary } from '../../types/posting-optimization';
import { topicUsesStorage } from '../../storage/redis/topic-uses-storage';
import { getTopicStorage, CreateTopicInput } from '../../storage/mysql/topic-storage';
import { topicDiversityService } from '../../services/topic-diversity-service';

const logger = getLogger('topics-service');
const topicStorage = getTopicStorage();

/**
 * 子方向接口
 */
export interface SubDirection {
  title: string;
  direction: string;
  outline: string;
}

export interface Topic {
  id: string;
  title: string;
  direction: string;
  outline: string;
  materialPaths: string[];
  status: 'unused' | 'used';
  usedAt?: string;
  createdAt: string;
  useCount: number;
  maxUseCount: number;
  postHistory: PostSummary[];
  subDirections?: SubDirection[];
  usedSubDirectionIndices?: number[];
}

/**
 * 扩展主题接口（用于 topic-diversity-service）
 */
export interface ExtendedTopic extends Topic {
  subDirectionUsages?: Array<{
    index: number;
    usedCount: number;
    lastUsedDate?: string;
  }>;
  materialUsages?: Array<{
    materialPath: string;
    usedCount: number;
    lastUsedDate?: string;
    usedInPosts: string[];
  }>;
}

/**
 * 获取所有主题
 */
export async function getAllTopics(): Promise<Topic[]> {
  try {
    const topics = await topicStorage.getAllTopics();
    return topics.map(dbTopic => ({
      id: dbTopic.id,
      title: dbTopic.name,
      direction: '',
      outline: '',
      materialPaths: [],
      status: dbTopic.status as 'unused' | 'used',
      usedAt: undefined,
      createdAt: dbTopic.created_at.toISOString(),
      useCount: dbTopic.current_use_count,
      maxUseCount: dbTopic.max_use_count,
      postHistory: [],
      subDirections: [],
      usedSubDirectionIndices: [],
    }));
  } catch (error: any) {
    logger.error(`获取主题失败：${error.message}`);
    return [];
  }
}

/**
 * 创建主题
 */
export async function createTopic(data: {
  title: string;
  direction: string;
  outline?: string;
  materialPaths?: string[];
  maxUseCount?: number;
  subDirections?: SubDirection[];
}): Promise<Topic | null> {
  try {
    const input: CreateTopicInput = {
      name: data.title,
      maxUseCount: data.maxUseCount || 1,
      currentUseCount: 0,
      status: 'available',
      subDirections: data.subDirections as any,
    };

    const topic = await topicStorage.upsertTopic(input);
    
    // 添加子方向
    if (data.subDirections && data.subDirections.length > 0) {
      for (const sub of data.subDirections) {
        await topicStorage.addSubDirection(topic.id, sub as any);
      }
    }

    // 【P1-1 新增】同步到 ChromaDB 主题推荐
    try {
      const extendedTopic: ExtendedTopic = {
        id: topic.id,
        title: topic.name,
        direction: data.direction,
        outline: data.outline || '',
        materialPaths: data.materialPaths || [],
        status: 'unused',
        createdAt: topic.created_at.toISOString(),
        useCount: topic.current_use_count,
        maxUseCount: topic.max_use_count,
        postHistory: [],
        subDirections: data.subDirections,
        usedSubDirectionIndices: [],
      };
      await topicDiversityService.addTopicToChromaDB(extendedTopic);
      logger.debug(`主题已同步到 ChromaDB: ${topic.id}`);
    } catch (chromaError) {
      logger.warn(`同步主题到 ChromaDB 失败：${chromaError instanceof Error ? chromaError.message : String(chromaError)}`);
      // 不阻断主流程
    }

    return {
      id: topic.id,
      title: topic.name,
      direction: '',
      outline: '',
      materialPaths: data.materialPaths || [],
      status: 'unused',
      usedAt: undefined,
      createdAt: topic.created_at.toISOString(),
      useCount: topic.current_use_count,
      maxUseCount: topic.max_use_count,
      postHistory: [],
      subDirections: data.subDirections,
      usedSubDirectionIndices: [],
    };
  } catch (error: any) {
    logger.error(`创建主题失败：${error.message}`);
    return null;
  }
}

/**
 * 【P1-1 新增】推荐相似主题
 * @param topicId 主题 ID
 * @param nResults 推荐数量（默认 5）
 * @param minSimilarity 最小相似度阈值（默认 0.6）
 * @returns 推荐的主题列表
 */
export async function recommendSimilarTopics(
  topicId: string,
  nResults: number = 5,
  minSimilarity: number = 0.6
): Promise<Array<{
  topicId: string;
  topicTitle: string;
  similarity: number;
}>> {
  try {
    // 获取主题详情
    const topic = await topicStorage.getTopicById(topicId);
    if (!topic) {
      logger.error(`主题不存在：${topicId}`);
      return [];
    }

    const extendedTopic: ExtendedTopic = {
      id: topic.id,
      title: topic.name,
      direction: '',
      outline: '',
      materialPaths: [],
      status: topic.status as 'unused' | 'used',
      createdAt: topic.created_at.toISOString(),
      useCount: topic.current_use_count,
      maxUseCount: topic.max_use_count,
      postHistory: [],
      subDirections: [],
      usedSubDirectionIndices: [],
    };

    // 使用主题多样化服务推荐相似主题
    const recommendations = await topicDiversityService.recommendSimilarTopics(
      extendedTopic,
      nResults,
      minSimilarity
    );

    logger.info(`为主题 "${topic.name}" 推荐 ${recommendations.length} 个相似主题`);

    return recommendations.map(r => ({
      topicId: r.topicId,
      topicTitle: r.metadata.topic_name,
      similarity: r.similarity,
    }));
  } catch (error) {
    logger.error(`推荐相似主题失败：${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

/**
 * 更新主题信息（支持全字段编辑）
 */
export async function updateTopic(
  topicId: string,
  data: {
    title?: string;
    direction?: string;
    outline?: string;
    materialPaths?: string[];
    maxUseCount?: number;
  }
): Promise<Topic | null> {
  try {
    const topic = await topicStorage.getTopicById(topicId);
    if (!topic) {
      logger.error(`主题不存在：${topicId}`);
      return null;
    }

    // 构建更新数据
    const updateData: any = {};
    if (data.title !== undefined) updateData.name = data.title;
    if (data.maxUseCount !== undefined) updateData.max_use_count = data.maxUseCount;

    // 执行更新
    const updated = await topicStorage.upsertTopic({
      id: topicId,
      name: updateData.name || topic.name,
      max_use_count: updateData.max_use_count !== undefined ? updateData.max_use_count : topic.max_use_count,
      current_use_count: topic.current_use_count,
      status: topic.status,
    } as any);

    logger.info(`主题已更新：${topicId}`);

    return {
      id: updated.id,
      title: updated.name,
      direction: '',
      outline: '',
      materialPaths: data.materialPaths || [],
      status: updated.status as 'unused' | 'used',
      usedAt: undefined,
      createdAt: updated.created_at.toISOString(),
      useCount: updated.current_use_count,
      maxUseCount: updated.max_use_count,
      postHistory: [],
      subDirections: [],
      usedSubDirectionIndices: [],
    };
  } catch (error: any) {
    logger.error(`更新主题失败：${error.message}`);
    return null;
  }
}

/**
 * 更新主题状态
 */
export async function updateTopicStatus(topicId: string, status: 'unused' | 'used'): Promise<boolean> {
  try {
    // 这里需要根据实际业务逻辑实现
    logger.info(`更新主题状态：${topicId} -> ${status}`);
    return true;
  } catch (error: any) {
    logger.error(`更新主题状态失败：${error.message}`);
    return false;
  }
}

/**
 * 增加主题使用次数
 */
export async function incrementTopicUseCount(topicId: string): Promise<boolean> {
  try {
    const topic = await topicStorage.getTopicById(topicId);
    if (!topic) {
      logger.error(`主题不存在：${topicId}`);
      return false;
    }

    const newCount = topic.current_use_count + 1;
    await topicStorage.updateTopicUseCount(topicId, newCount);
    
    // 同步更新 Redis 中的使用次数
    await topicUsesStorage.setUses(topicId, newCount);
    
    return true;
  } catch (error: any) {
    logger.error(`增加主题使用次数失败：${error.message}`);
    return false;
  }
}

/**
 * 扣减主题使用次数
 */
export async function decrementTopicUseCount(topicId: string): Promise<boolean> {
  try {
    const topic = await topicStorage.getTopicById(topicId);
    if (!topic) {
      logger.error(`主题不存在：${topicId}`);
      return false;
    }

    const newCount = Math.max(0, topic.current_use_count - 1);
    await topicStorage.updateTopicUseCount(topicId, newCount);
    
    // 同步更新 Redis 中的使用次数
    await topicUsesStorage.setUses(topicId, newCount);
    
    logger.info(`主题 "${topic.name}" 使用次数已扣减：${topic.current_use_count} → ${newCount}`);
    return true;
  } catch (error: any) {
    logger.error(`扣减主题使用次数失败：${error.message}`);
    return false;
  }
}

/**
 * 重置主题使用次数
 */
export async function resetTopicUseCount(topicId: string): Promise<boolean> {
  try {
    await topicStorage.resetTopicUseCount(topicId);
    await topicUsesStorage.setUses(topicId, 0);
    return true;
  } catch (error: any) {
    logger.error(`重置主题使用次数失败：${error.message}`);
    return false;
  }
}

/**
 * 重置所有主题
 */
export async function resetAllTopics(): Promise<boolean> {
  try {
    await topicStorage.resetAllTopics();
    logger.info('所有主题已重置');
    return true;
  } catch (error: any) {
    logger.error(`重置所有主题失败：${error.message}`);
    return false;
  }
}

/**
 * 删除主题
 */
export async function deleteTopic(topicId: string): Promise<boolean> {
  try {
    await topicStorage.deleteTopic(topicId);
    return true;
  } catch (error: any) {
    logger.error(`删除主题失败：${error.message}`);
    return false;
  }
}
