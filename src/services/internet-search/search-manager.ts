/**
 * 互联网搜索服务管理器
 * 负责：
 * 1. 管理所有平台搜索服务
 * 2. 实现平台轮询策略
 * 3. 提供统一的搜索接口
 */

import { ISearchPlatform, SearchResult, PlatformConfig } from './platform-base';
import { XiaohongshuSearch } from './xiaohongshu-search';
import { WeiboSearch } from './weibo-search';
import { ZhihuSearch } from './zhihu-search';
import { AutohomeSearch } from './autohome-search';
import { getInternetReferencePlatformStorage } from '../../storage/mysql/internet-reference-platform-storage';
import { getLogger } from '../../utils/logger';

const logger = getLogger('internet-search-manager');

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
      this.platforms.set('weibo', new WeiboSearch());
      logger.info('✅ 微博搜索服务已初始化');
    } catch (error) {
      logger.warn('微博搜索服务初始化失败:', error instanceof Error ? error.message : String(error));
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
   * 选择下一个平台（轮询策略）
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
    
    // 轮询策略：选择与上次不同的平台
    if (this.lastUsedPlatform) {
      const otherPlatforms = platforms.filter(p => p.getPlatformName() !== this.lastUsedPlatform);
      
      if (otherPlatforms.length > 0) {
        // 按优先级排序（需要从数据库获取优先级）
        const sortedPlatforms = await this.sortByPriority(otherPlatforms);
        const selected = sortedPlatforms[0];
        
        this.lastUsedPlatform = selected.getPlatformName();
        logger.info(`选择平台：${selected.getPlatformDisplayName()} (${selected.getPlatformName()})`);
        
        return selected;
      }
    }
    
    // 默认返回优先级最高的平台
    const sortedPlatforms = await this.sortByPriority(platforms);
    const selected = sortedPlatforms[0];
    
    this.lastUsedPlatform = selected.getPlatformName();
    logger.info(`选择平台：${selected.getPlatformDisplayName()} (${selected.getPlatformName()})`);
    
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
   * 搜索（使用轮询策略）
   */
  async search(keywords: string[], maxResults: number = 5): Promise<SearchResult[]> {
    // 选择平台
    const platform = await this.selectNextPlatform();
    
    if (!platform) {
      logger.warn('没有可用平台，返回空结果');
      return [];
    }
    
    try {
      logger.info(`开始搜索，平台：${platform.getPlatformDisplayName()}, 关键词：${keywords.join(', ')}`);
      
      // 执行搜索
      const results = await platform.search(keywords, maxResults);
      
      logger.info(`搜索完成，平台：${platform.getPlatformDisplayName()}, 结果数：${results.length}`);
      
      return results;
      
    } catch (error) {
      logger.error(`平台 ${platform.getPlatformDisplayName()} 搜索失败:`, error instanceof Error ? error.message : String(error));
      
      // 降级：尝试其他平台
      logger.warn(`尝试使用其他平台...`);
      const fallbackResults = await this.searchWithFallback(keywords, maxResults, platform.getPlatformName());
      
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
}

// 导出单例
export const internetSearchManager = new InternetSearchManager();
