import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('internet-reference-platform-storage');

/**
 * 互联网参考平台配置
 */
export interface InternetReferencePlatform {
  id: number;
  platformName: string;       // 平台标识（如：xiaohongshu, weibo）
  displayName: string;        // 平台显示名称（如：小红书，微博）
  enabled: boolean;           // 是否启用
  priority: number;           // 优先级（1-10）
  weight: number;             // 权重（0-1）
  searchScript: string;       // 搜索脚本名称
  apiEndpoint?: string;       // API 端点（可选）
  rateLimitPerHour: number;   // 每小时频率限制
  description?: string;       // 平台描述
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 平台选择策略
 */
export type PlatformSelectionStrategy = 'round-robin' | 'priority' | 'random';

class InternetReferencePlatformStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['internet_reference_platforms']);
      if (rows.length === 0) {
        logger.warn('internet_reference_platforms 表不存在，需要先运行数据库迁移');
        throw new Error('internet_reference_platforms 表不存在，请先运行数据库迁移脚本');
      }
      this.initialized = true;
      logger.info('互联网参考平台配置存储初始化完成');
    } catch (error) {
      logger.error('互联网参考平台配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 获取所有平台配置
   */
  async getAllPlatforms(): Promise<InternetReferencePlatform[]> {
    try {
      const rows = await this.query<any[]>(
        'SELECT * FROM internet_reference_platforms ORDER BY priority DESC, platform_name ASC'
      );
      return rows.map(row => this.mapToPlatform(row));
    } catch (error) {
      logger.error('获取所有平台配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 获取启用的平台列表
   */
  async getEnabledPlatforms(): Promise<InternetReferencePlatform[]> {
    try {
      const rows = await this.query<any[]>(
        'SELECT * FROM internet_reference_platforms WHERE enabled = 1 ORDER BY priority DESC'
      );
      return rows.map(row => this.mapToPlatform(row));
    } catch (error) {
      logger.error('获取启用的平台列表失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 根据平台标识获取配置
   */
  async getPlatformByName(platformName: string): Promise<InternetReferencePlatform | null> {
    try {
      const row = await this.queryOne<any[]>(
        'SELECT * FROM internet_reference_platforms WHERE platform_name = ?',
        [platformName]
      );
      return row ? this.mapToPlatform(row) : null;
    } catch (error) {
      logger.error(`获取平台 ${platformName} 配置失败:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * 选择下一个平台（轮询策略）
   */
  async selectNextPlatform(lastUsedPlatform?: string): Promise<InternetReferencePlatform | null> {
    try {
      const platforms = await this.getEnabledPlatforms();
      
      if (platforms.length === 0) {
        logger.warn('没有启用的平台');
        return null;
      }

      if (platforms.length === 1) {
        return platforms[0];
      }

      // 轮询策略：选择与上次不同的平台
      if (lastUsedPlatform) {
        const otherPlatforms = platforms.filter(p => p.platformName !== lastUsedPlatform);
        if (otherPlatforms.length > 0) {
          // 按优先级排序，选择优先级最高的
          otherPlatforms.sort((a, b) => b.priority - a.priority);
          return otherPlatforms[0];
        }
      }

      // 默认返回优先级最高的平台
      return platforms[0];
    } catch (error) {
      logger.error('选择下一个平台失败:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * 根据权重随机选择平台
   */
  async selectPlatformByWeight(): Promise<InternetReferencePlatform | null> {
    try {
      const platforms = await this.getEnabledPlatforms();
      
      if (platforms.length === 0) {
        return null;
      }

      if (platforms.length === 1) {
        return platforms[0];
      }

      // 计算总权重
      const totalWeight = platforms.reduce((sum, p) => sum + p.weight, 0);
      
      // 随机选择一个权重值
      let random = Math.random() * totalWeight;
      
      for (const platform of platforms) {
        random -= platform.weight;
        if (random <= 0) {
          return platform;
        }
      }

      // 默认返回第一个
      return platforms[0];
    } catch (error) {
      logger.error('根据权重随机选择平台失败:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * 保存平台配置
   */
  async savePlatform(platform: InternetReferencePlatform): Promise<void> {
    try {
      const exists = await this.getPlatformByName(platform.platformName);
      
      if (exists) {
        // 更新
        await this.query(
          `UPDATE internet_reference_platforms 
           SET display_name = ?, enabled = ?, priority = ?, weight = ?, search_script = ?,
               api_endpoint = ?, rate_limit_per_hour = ?, description = ?
           WHERE platform_name = ?`,
          [
            platform.displayName,
            platform.enabled ? 1 : 0,
            platform.priority,
            platform.weight,
            platform.searchScript,
            platform.apiEndpoint || null,
            platform.rateLimitPerHour,
            platform.description || null,
            platform.platformName,
          ]
        );
        logger.info(`平台配置已更新：${platform.displayName}`);
      } else {
        // 新增
        await this.query(
          `INSERT INTO internet_reference_platforms 
           (platform_name, display_name, enabled, priority, weight, search_script, 
            api_endpoint, rate_limit_per_hour, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            platform.platformName,
            platform.displayName,
            platform.enabled ? 1 : 0,
            platform.priority,
            platform.weight,
            platform.searchScript,
            platform.apiEndpoint || null,
            platform.rateLimitPerHour,
            platform.description || null,
          ]
        );
        logger.info(`平台配置已新增：${platform.displayName}`);
      }
    } catch (error) {
      logger.error(`保存平台配置失败:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 批量保存平台配置
   */
  async savePlatforms(platforms: InternetReferencePlatform[]): Promise<void> {
    try {
      for (const platform of platforms) {
        await this.savePlatform(platform);
      }
      logger.info(`批量保存 ${platforms.length} 个平台配置成功`);
    } catch (error) {
      logger.error(`批量保存平台配置失败:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 删除平台配置
   */
  async deletePlatform(platformName: string): Promise<void> {
    try {
      await this.query(
        'DELETE FROM internet_reference_platforms WHERE platform_name = ?',
        [platformName]
      );
      logger.info(`平台配置已删除：${platformName}`);
    } catch (error) {
      logger.error(`删除平台配置失败:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 更新平台启用状态
   */
  async updatePlatformEnabled(platformName: string, enabled: boolean): Promise<void> {
    try {
      await this.query(
        'UPDATE internet_reference_platforms SET enabled = ? WHERE platform_name = ?',
        [enabled ? 1 : 0, platformName]
      );
      logger.info(`平台启用状态已更新：${platformName} -> ${enabled}`);
    } catch (error) {
      logger.error(`更新平台启用状态失败:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 更新平台优先级
   */
  async updatePlatformPriority(platformName: string, priority: number): Promise<void> {
    try {
      await this.query(
        'UPDATE internet_reference_platforms SET priority = ? WHERE platform_name = ?',
        [priority, platformName]
      );
      logger.info(`平台优先级已更新：${platformName} -> ${priority}`);
    } catch (error) {
      logger.error(`更新平台优先级失败:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 转换为平台对象
   */
  private mapToPlatform(row: any): InternetReferencePlatform {
    return {
      id: row.id,
      platformName: row.platform_name,
      displayName: row.display_name,
      enabled: row.enabled === 1,
      priority: row.priority,
      weight: parseFloat(row.weight),
      searchScript: row.search_script,
      apiEndpoint: row.api_endpoint,
      rateLimitPerHour: row.rate_limit_per_hour,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

let instance: InternetReferencePlatformStorage | null = null;
export function getInternetReferencePlatformStorage(): InternetReferencePlatformStorage {
  if (!instance) instance = new InternetReferencePlatformStorage();
  return instance;
}
export const internetReferencePlatformStorage = getInternetReferencePlatformStorage();
