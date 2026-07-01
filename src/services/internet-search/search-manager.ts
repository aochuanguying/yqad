/**
 * 互联网搜索服务管理器
 * 负责：
 * 1. 管理所有平台搜索服务
 * 2. 实现平台轮询策略
 * 3. 提供统一的搜索接口
 */

import { ISearchPlatform, SearchResult, PlatformConfig } from './platform-base';
import { XiaohongshuSearch } from './xiaohongshu-search';
import { ZhihuSearch } from './zhihu-search';
import { AutohomeSearch } from './autohome-search';
import { getInternetReferencePlatformStorage } from '../../storage/mysql/internet-reference-platform-storage';
import { getInternetReferenceStorage, InternetReferenceConfig } from '../../storage/mysql/internet-reference-storage';
import { getLogger } from '../../utils/logger';
import { searchRateLimitStorage } from '../../storage/redis/search-rate-limit-storage';
import { getSearchEffectStorage } from '../../storage/mysql/search-effect-storage';

const logger = getLogger('internet-search-manager');

/**
 * 搜索词选择器接口（任务 2.1）
 */
interface ISearchKeywordSelector {
  select(keywords: string[], platform: string): string;
}

/**
 * 平台感知的搜索词选择器（任务 2.2）
 */
export class PlatformAwareKeywordSelector implements ISearchKeywordSelector {
  /**
   * 根据平台选择搜索词
   */
  select(keywords: string[], platform: string): string {
    switch (platform) {
      case 'xiaohongshu':
        return this.selectXiaohongshuKeyword(keywords);
      case 'zhihu':
        return this.selectZhihuKeyword(keywords);
      case 'autohome':
        return this.selectAutohomeKeyword(keywords);
      default:
        return keywords[0] || '';
    }
  }

  /**
   * 小红书搜索词选择（任务 2.3）
   * 特点：从预配置词库选择，避免频繁更换
   */
  private selectXiaohongshuKeyword(keywords: string[]): string {
    if (keywords.length === 0) return '';
    
    // 从预配置词库中选择，避免频繁更换触发风控
    // 使用小时级切换，每小时使用同一个搜索词
    const hour = Math.floor(Date.now() / 3600000);
    const index = hour % keywords.length;
    
    // 优先选择"车型 + 场景"组合词（2-5 字）
    const keyword = keywords[index];
    logger.debug(`小红书搜索词选择：${keyword} (索引：${index})`);
    
    return keyword;
  }

  /**
   * 知乎搜索词选择（任务 2.4）
   * 特点：使用专业术语和问题形式
   */
  private selectZhihuKeyword(keywords: string[]): string {
    if (keywords.length === 0) return '';
    
    // 优先选择包含"如何"、"评价"、"对比"的专业问句
    const professionalKeywords = keywords.filter(
      k => k.includes('如何') || k.includes('评价') || k.includes('vs') || k.includes('对比')
    );
    
    if (professionalKeywords.length > 0) {
      const keyword = professionalKeywords[0];
      logger.debug(`知乎专业搜索词选择：${keyword}`);
      return keyword;
    }
    
    // 如果没有专业问句，选择最长的搜索词（充分利用 API 字符限制）
    const longestKeyword = keywords.reduce((a, b) => a.length > b.length ? a : b);
    logger.debug(`知乎搜索词选择（最长）：${longestKeyword}`);
    
    return longestKeyword;
  }

  /**
   * 汽车之家搜索词选择
   * 特点：使用精准的论坛术语，优先返回 card 类型结果
   * 策略：
   * - 包含"提车"、"作业"、"用车"等词优先（容易返回 card）
   * - 2-4 字短词优先
   * - 避免太宽泛的词（如"奥迪"会返回 box）
   */
  private selectAutohomeKeyword(keywords: string[]): string {
    if (keywords.length === 0) return '';
    
    // 优先选择包含论坛术语的词
    const forumKeywords = keywords.filter(k => 
      k.includes('提车') || k.includes('作业') || k.includes('用车') || 
      k.includes('试驾') || k.includes('保养') || k.includes('油耗')
    );
    
    if (forumKeywords.length > 0) {
      const keyword = forumKeywords[0];
      logger.debug(`汽车之家搜索词选择（论坛术语）：${keyword}`);
      return keyword;
    }
    
    // 其次选择 2-4 字短词
    const shortKeywords = keywords.filter(k => k.length >= 2 && k.length <= 4);
    
    if (shortKeywords.length > 0) {
      const keyword = shortKeywords[0];
      logger.debug(`汽车之家搜索词选择（短词）：${keyword}`);
      return keyword;
    }
    
    // 如果没有短词，选择第一个关键词
    const keyword = keywords[0];
    logger.debug(`汽车之家搜索词选择：${keyword}`);
    
    return keyword;
  }
}

// 导出选择器实例
export const keywordSelector = new PlatformAwareKeywordSelector();

/**
 * 搜索服务管理器类
 */
export class InternetSearchManager {
  private platforms: Map<string, ISearchPlatform> = new Map();
  private lastUsedPlatform: string | undefined;
  private initialized = false;
  
  constructor() {
    this.initializePlatforms();
  }
  
  /**
   * 初始化所有平台
   */
  private initializePlatforms(): void {
    // 注册所有平台
    try {
      this.platforms.set('xiaohongshu', new XiaohongshuSearch());
      logger.info('✅ 小红书搜索服务已初始化');
    } catch (error) {
      logger.warn('小红书搜索服务初始化失败:', error instanceof Error ? error.message : String(error));
    }
    
    try {
      this.platforms.set('zhihu', new ZhihuSearch());
      logger.info('✅ 知乎搜索服务已初始化');
    } catch (error) {
      logger.warn('知乎搜索服务初始化失败:', error instanceof Error ? error.message : String(error));
    }
    
    try {
      this.platforms.set('autohome', new AutohomeSearch());
      logger.info('✅ 汽车之家搜索服务已初始化');
    } catch (error) {
      logger.warn('汽车之家搜索服务初始化失败:', error instanceof Error ? error.message : String(error));
    }
    
    logger.info(`已初始化 ${this.platforms.size} 个搜索平台`);
  }
  
  /**
   * 获取所有可用的平台
   */
  async getAvailablePlatforms(): Promise<ISearchPlatform[]> {
    try {
      const platformStorage = getInternetReferencePlatformStorage();
      const enabledPlatforms = await platformStorage.getEnabledPlatforms();
      
      const availableServices: ISearchPlatform[] = [];
      
      for (const platform of enabledPlatforms) {
        const service = this.platforms.get(platform.platformName);
        if (service) {
          availableServices.push(service);
        }
      }
      
      return availableServices;
    } catch (error) {
      logger.error('获取可用平台失败:', error instanceof Error ? error.message : String(error));
      // 返回所有已注册的平台
      return Array.from(this.platforms.values());
    }
  }
  
  /**
   * 选择下一个平台（智能推荐 + 轮询混合策略）（任务 4.1-4.5）
   */
  async selectNextPlatform(): Promise<ISearchPlatform | null> {
    const platforms = await this.getAvailablePlatforms();
    
    if (platforms.length === 0) {
      logger.warn('没有可用的搜索平台');
      return null;
    }
    
    if (platforms.length === 1) {
      return platforms[0];
    }
    
    // 任务 4.1: 计算基础优先级
    const basePriorities = await this.calculateBasePriorities();
    
    // 任务 4.2: 根据频率限制调整
    const adjustedPriorities = await this.adjustByRateLimit(basePriorities);
    
    // 任务 4.3: 根据成功率调整
    const finalPriorities = await this.adjustBySuccessRate(adjustedPriorities);
    
    // 任务 4.5: 使用优先级 + 轮询混合策略
    return this.weightedRandomSelect(platforms, finalPriorities);
  }

  /**
   * 任务 4.1: 计算基础优先级
   */
  private async calculateBasePriorities(): Promise<Map<string, number>> {
    try {
      const storage = getInternetReferenceStorage();
      const priorities = await storage.getPlatformPriorities();
      
      logger.debug(`基础优先级：${JSON.stringify(Object.fromEntries(priorities))}`);
      return priorities;
    } catch (error) {
      logger.warn('获取基础优先级失败，使用默认优先级');
      // 返回默认优先级
      return new Map([
        ['xiaohongshu', 8],
        ['zhihu', 7],
        ['autohome', 8]
      ]);
    }
  }

  /**
   * 任务 4.2: 根据频率限制调整优先级
   */
  private async adjustByRateLimit(priorities: Map<string, number>): Promise<Map<string, number>> {
    const adjusted = new Map<string, number>();
    
    try {
      for (const [platform, priority] of priorities.entries()) {
        // 从 Redis 获取当前小时的查询次数
        const queryCount = await searchRateLimitStorage.getQueryCount(platform);
        
        // 获取平台的频率限制配置
        const platformConfig = await getInternetReferencePlatformStorage().getPlatformByName(platform);
        const rateLimit = platformConfig?.rateLimitPerHour || 10; // 默认 10 次/小时
        
        // 根据使用率降低优先级
        const usageRate = queryCount / rateLimit;
        let adjustedPriority = priority;
        
        if (usageRate > 0.8) {
          // 使用率超过 80%，大幅降低优先级
          adjustedPriority = Math.max(1, priority - 3);
          logger.debug(`平台 ${platform} 频率限制预警：${queryCount}/${rateLimit}，调整后优先级：${adjustedPriority}`);
        } else if (usageRate > 0.5) {
          // 使用率超过 50%，适度降低优先级
          adjustedPriority = Math.max(1, priority - 1);
          logger.debug(`平台 ${platform} 频率限制注意：${queryCount}/${rateLimit}，调整后优先级：${adjustedPriority}`);
        } else {
          adjusted.set(platform, priority);
        }
        
        adjusted.set(platform, adjustedPriority);
      }
    } catch (error) {
      logger.warn(`频率限制调整失败：${error instanceof Error ? error.message : String(error)}`);
      // 返回原始优先级
      return priorities;
    }
    
    logger.debug(`频率限制调整后优先级：${JSON.stringify(Object.fromEntries(adjusted))}`);
    return adjusted;
  }

  /**
   * 任务 4.3: 根据成功率调整优先级
   */
  private async adjustBySuccessRate(priorities: Map<string, number>): Promise<Map<string, number>> {
    const adjusted = new Map<string, number>();
    
    try {
      const storage = getInternetReferenceStorage();
      const allPlatforms = await storage.getAllPlatformConfigs();
      
      // 创建成功率映射
      const successRateMap = new Map<string, number>();
      if (Array.isArray(allPlatforms)) {
        for (const p of allPlatforms) {
          successRateMap.set(p.platformName, p.successRate);
        }
      }
      
      for (const [platform, priority] of priorities.entries()) {
        const successRate = successRateMap.get(platform) || 100.0;
        
        // 成功率奖励：成功率 > 90% 时，优先级 +1
        let adjustedPriority = priority;
        if (successRate > 90) {
          adjustedPriority = Math.min(10, priority + 1);
        } else if (successRate < 50) {
          // 成功率惩罚：成功率 < 50% 时，优先级 -2
          adjustedPriority = Math.max(1, priority - 2);
        }
        
        adjusted.set(platform, adjustedPriority);
        logger.debug(`平台 ${platform} 成功率：${successRate}%, 调整后优先级：${adjustedPriority}`);
      }
    } catch (error) {
      logger.warn('获取成功率失败，使用原始优先级');
      return priorities;
    }
    
    logger.debug(`成功率调整后优先级：${JSON.stringify(Object.fromEntries(adjusted))}`);
    return adjusted;
  }

  /**
   * 任务 4.4: 权重随机选择算法
   */
  private weightedRandomSelect(
    platforms: ISearchPlatform[],
    priorities: Map<string, number>
  ): ISearchPlatform {
    // 计算总权重
    let totalWeight = 0;
    const weights: number[] = [];
    
    for (const platform of platforms) {
      const priority = priorities.get(platform.getPlatformName()) || 5;
      
      // 任务 4.5: 最近使用惩罚
      let weight = priority;
      if (this.lastUsedPlatform === platform.getPlatformName()) {
        weight = Math.max(1, priority - 3);  // 刚使用过的平台优先级降低 3
      }
      
      weights.push(weight);
      totalWeight += weight;
    }
    
    // 权重随机选择
    let random = Math.random() * totalWeight;
    let selected = platforms[0];
    
    for (let i = 0; i < platforms.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selected = platforms[i];
        break;
      }
    }
    
    this.lastUsedPlatform = selected.getPlatformName();
    logger.info(`智能选择平台：${selected.getPlatformDisplayName()} (${selected.getPlatformName()})`);
    
    return selected;
  }
  
  /**
   * 按优先级排序平台
   */
  private async sortByPriority(platforms: ISearchPlatform[]): Promise<ISearchPlatform[]> {
    try {
      const platformStorage = getInternetReferencePlatformStorage();
      const allPlatforms = await platformStorage.getAllPlatforms();
      
      // 创建优先级映射
      const priorityMap = new Map<string, number>();
      allPlatforms.forEach(p => {
        priorityMap.set(p.platformName, p.priority);
      });
      
      // 排序
      return platforms.sort((a, b) => {
        const priorityA = priorityMap.get(a.getPlatformName()) || 5;
        const priorityB = priorityMap.get(b.getPlatformName()) || 5;
        return priorityB - priorityA;
      });
    } catch (error) {
      logger.warn('按优先级排序失败，使用默认排序:', error instanceof Error ? error.message : String(error));
      return platforms;
    }
  }
  
  /**
   * 搜索（使用轮询策略 + 分平台搜索词选择）（任务 2.6）
   */
  async search(keywords: string[], maxResults: number = 5): Promise<SearchResult[]> {
    // 选择平台
    const platform = await this.selectNextPlatform();
    
    if (!platform) {
      logger.warn('没有可用平台，返回空结果');
      return [];
    }
    
    const platformName = platform.getPlatformName();
    
    // 任务 2.6: 根据平台选择搜索词
    const selectedKeyword = keywordSelector.select(keywords, platformName);
    
    try {
      logger.info(`开始搜索，平台：${platform.getPlatformDisplayName()}, 原始关键词：${keywords.join(', ')}, 优化后搜索词：${selectedKeyword}`);
      
      // 增加查询计数
      await searchRateLimitStorage.incrementQueryCount(platformName);
      
      // 执行搜索（使用优化后的搜索词）
      const results = await platform.search([selectedKeyword], maxResults);
      
      logger.info(`搜索完成，平台：${platform.getPlatformDisplayName()}, 结果数：${results.length}`);
      
      // 任务 2.7: 记录搜索效果
      await this.recordSearchEffect(platformName, true, results.length, selectedKeyword);
      
      return results;
      
    } catch (error) {
      logger.error(`平台 ${platform.getPlatformDisplayName()} 搜索失败:`, error instanceof Error ? error.message : String(error));
      
      // 任务 2.7: 记录搜索失败
      await this.recordSearchEffect(platformName, false, 0, selectedKeyword);
      
      // 降级：尝试其他平台
      logger.warn(`尝试使用其他平台...`);
      const fallbackResults = await this.searchWithFallback(keywords, maxResults, platformName);
      
      return fallbackResults;
    }
  }
  
  /**
   * 降级搜索（当首选平台失败时）
   */
  private async searchWithFallback(
    keywords: string[], 
    maxResults: number, 
    excludePlatform: string
  ): Promise<SearchResult[]> {
    const platforms = await this.getAvailablePlatforms();
    const fallbackPlatforms = platforms.filter(p => p.getPlatformName() !== excludePlatform);
    
    for (const platform of fallbackPlatforms) {
      try {
        logger.info(`降级搜索，平台：${platform.getPlatformDisplayName()}`);
        const results = await platform.search(keywords, maxResults);
        
        if (results.length > 0) {
          return results;
        }
      } catch (error) {
        logger.warn(`平台 ${platform.getPlatformDisplayName()} 降级搜索失败:`, error instanceof Error ? error.message : String(error));
        // 继续尝试下一个平台
      }
    }
    
    logger.warn('所有平台降级搜索失败，返回空结果');
    return [];
  }
  
  /**
   * 获取平台数量
   */
  getPlatformCount(): number {
    return this.platforms.size;
  }

  /**
   * 任务 2.7: 记录搜索效果
   */
  private async recordSearchEffect(
    platform: string,
    success: boolean,
    resultCount: number,
    keyword: string
  ): Promise<void> {
    try {
      const storage = getInternetReferenceStorage();
      
      // 记录成功率
      await storage.recordSuccess(platform, success);
      
      // 记录到数据库的详细记录表
      const effectStorage = getSearchEffectStorage();
      await effectStorage.recordSearchEffect({
        platform,
        keyword,
        resultCount,
        success,
      });
      
      logger.debug(`搜索效果记录 - 平台：${platform}, 成功：${success}, 结果数：${resultCount}, 搜索词：${keyword}`);
    } catch (error) {
      logger.warn('记录搜索效果失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 任务 2.8: 分析搜索词效果
   */
  async analyzeKeywordEffectiveness(platform: string): Promise<{
    keyword: string;
    successRate: number;
    avgResultCount: number;
    usageCount: number;
  }[]> {
    try {
      // 从数据库查询统计信息
      const effectStorage = getSearchEffectStorage();
      const rankings = await effectStorage.getPlatformKeywordRanking(platform, 10);
      
      if (rankings.length === 0) {
        logger.info(`平台 ${platform} 暂无搜索词统计数据`);
        return [];
      }
      
      logger.info(`平台 ${platform} 搜索词效果分析完成，共 ${rankings.length} 个搜索词`);
      return rankings;
    } catch (error) {
      logger.error('分析搜索词效果失败:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * 任务 4.6: 记录平台使用统计
   */
  private async recordPlatformUsage(
    platform: string,
    success: boolean,
    resultCount: number
  ): Promise<void> {
    try {
      const storage = getInternetReferenceStorage();
      
      // 记录成功率
      await storage.recordSuccess(platform, success);
      
      // TODO: 记录查询次数和素材质量
      logger.debug(`平台使用统计 - 平台：${platform}, 成功：${success}, 结果数：${resultCount}`);
    } catch (error) {
      logger.warn('记录平台使用统计失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 任务 4.8: 获取平台优先级
   */
  async getPlatformPriorities(): Promise<Map<string, number>> {
    try {
      const storage = getInternetReferenceStorage();
      return await storage.getPlatformPriorities();
    } catch (error) {
      logger.error('获取平台优先级失败:', error instanceof Error ? error.message : String(error));
      return new Map();
    }
  }

  /**
   * 任务 4.8: 更新平台优先级
   */
  async updatePlatformPriority(platform: string, priority: number): Promise<void> {
    try {
      const storage = getInternetReferenceStorage();
      await storage.updatePlatformPriority(platform, priority);
      logger.info(`平台 ${platform} 优先级已更新为 ${priority}`);
    } catch (error) {
      logger.error('更新平台优先级失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// 导出单例
export const internetSearchManager = new InternetSearchManager();
