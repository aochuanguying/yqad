import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { AppConfig, loadConfig, resetConfigCache } from '../../utils/config';
import { getLogger } from '../../utils/logger';
import { configEvents } from './config-events';
import { validateConfigGroup } from './config-validator';
import { aiProviderStorage } from '../../storage/mysql/ai-provider-storage';
import { apiConfigStorage } from '../../storage/mysql/api-config-storage';
import { commentConfigStorage } from '../../storage/mysql/comment-config-storage';
import { postConfigStorage } from '../../storage/mysql/post-config-storage';
import { featuredPostingStorage } from '../../storage/mysql/featured-posting-storage';
import { schedulerConfigStorage } from '../../storage/mysql/scheduler-config-storage';
import { contentLimitsStorage } from '../../storage/mysql/content-limits-storage';
import { internetReferenceStorage } from '../../storage/mysql/internet-reference-storage';
import { contentDeduplicationStorage } from '../../storage/mysql/content-deduplication-storage';
import { sensitiveWordFilterStorage } from '../../storage/mysql/sensitive-word-filter-storage';
import { contentQualityScoringStorage } from '../../storage/mysql/content-quality-scoring-storage';
import { postingIntervalControlStorage } from '../../storage/mysql/posting-interval-control-storage';
import { vehicleMonitorStorage } from '../../storage/mysql/vehicle-monitor-storage';
import { telecomApiStorage } from '../../storage/mysql/telecom-api-storage';
import { autojsApiStorage } from '../../storage/mysql/autojs-api-storage';
import { complianceReportConfigStorage } from '../../storage/mysql/compliance-report-config-storage';

const logger = getLogger('config-service');

// 延迟获取 vehicleTokenStorage，避免模块加载时 Redis 未初始化
function getVehicleToken() {
  const { getVehicleTokenStorage } = require('../../storage/redis/vehicle-token-storage');
  return getVehicleTokenStorage();
}

const CONFIG_PATH = path.resolve(process.cwd(), 'config/default.yaml');

// 配置分组名称列表
export const CONFIG_GROUPS = [
  'api', 'auth', 'ai', 'comment', 'post',
  'featuredPosting', 'analysis', 'scheduler', 'web', 'materials', 'contentLimits',
  'vehicleMonitor', 'autojsApi', 'telecomApi', 'complianceCheckReport',
  'internetReference', 'contentDeduplication', 'sensitiveWordFilter',
  'contentQualityScoring', 'postingIntervalControl'
] as const;

export type ConfigGroup = typeof CONFIG_GROUPS[number];

// 内存写入锁
let writeLock = false;

/**
 * 获取全部配置
 */
export async function getAllConfig(): Promise<AppConfig> {
  resetConfigCache();
  let config = loadConfig();
  
  // 特殊处理 vehicleMonitor 配置：从数据库读取
  try {
    const dbVehicleMonitorConfig = await vehicleMonitorStorage.getConfig();
    if (dbVehicleMonitorConfig) {
      config = {
        ...config,
        vehicleMonitor: dbVehicleMonitorConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取车辆监控配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 vehicleMonitor 配置：如果 Redis 中有 Token，优先返回 Redis 中的 Token（热更新）
  try {
    const vehicleToken = getVehicleToken();
    logger.debug('getVehicleToken 调用成功:', !!vehicleToken);
    const token = await vehicleToken.getToken();
    logger.debug('Redis Token:', token ? `${token.substring(0, 20)}...` : 'null');
    if (token && config.vehicleMonitor) {
      config = {
        ...config,
        vehicleMonitor: {
          ...config.vehicleMonitor,
          token,
        },
      };
      logger.debug('已更新 config.vehicleMonitor.token');
    }
  } catch (error) {
    logger.warn('从 Redis 读取车辆 Token 失败:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 api 配置：从数据库读取
  try {
    const dbApiConfig = await apiConfigStorage.getConfig();
    if (dbApiConfig) {
      config = {
        ...config,
        api: dbApiConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取 API 配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 comment 配置：从数据库读取
  try {
    const dbCommentConfig = await commentConfigStorage.getConfig();
    if (dbCommentConfig) {
      config = {
        ...config,
        comment: dbCommentConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取评论配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 post 配置：从数据库读取
  try {
    const dbPostConfig = await postConfigStorage.getConfig();
    if (dbPostConfig) {
      config = {
        ...config,
        post: dbPostConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取发帖配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 featuredPosting 配置：从数据库读取
  try {
    const dbFeaturedPostingConfig = await featuredPostingStorage.getConfig();
    if (dbFeaturedPostingConfig) {
      config = {
        ...config,
        featuredPosting: dbFeaturedPostingConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取精选发帖配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 scheduler 配置：从数据库读取
  try {
    const dbSchedulerConfig = await schedulerConfigStorage.getConfig();
    if (dbSchedulerConfig) {
      config = {
        ...config,
        scheduler: dbSchedulerConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取调度器配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 contentLimits 配置：从数据库读取
  try {
    const dbContentLimitsConfig = await contentLimitsStorage.getConfig();
    if (dbContentLimitsConfig) {
      config = {
        ...config,
        contentLimits: dbContentLimitsConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取内容限制配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 internetReference 配置：从数据库读取
  try {
    const dbInternetReferenceConfig = await internetReferenceStorage.getConfig();
    if (dbInternetReferenceConfig) {
      config = {
        ...config,
        internetReference: dbInternetReferenceConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取互联网参考配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 contentDeduplication 配置：从数据库读取
  try {
    const dbContentDeduplicationConfig = await contentDeduplicationStorage.getConfig();
    if (dbContentDeduplicationConfig) {
      config = {
        ...config,
        contentDeduplication: dbContentDeduplicationConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取内容去重配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 sensitiveWordFilter 配置：从数据库读取
  try {
    const dbSensitiveWordFilterConfig = await sensitiveWordFilterStorage.getConfig();
    if (dbSensitiveWordFilterConfig) {
      config = {
        ...config,
        sensitiveWordFilter: dbSensitiveWordFilterConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取敏感词过滤配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 contentQualityScoring 配置：从数据库读取
  try {
    const dbContentQualityScoringConfig = await contentQualityScoringStorage.getConfig();
    if (dbContentQualityScoringConfig) {
      config = {
        ...config,
        contentQualityScoring: dbContentQualityScoringConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取内容质量评分配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 postingIntervalControl 配置：从数据库读取
  try {
    const dbPostingIntervalControlConfig = await postingIntervalControlStorage.getConfig();
    if (dbPostingIntervalControlConfig) {
      config = {
        ...config,
        postingIntervalControl: dbPostingIntervalControlConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取发帖间隔控制配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 telecomApi 配置：从数据库读取
  try {
    const dbTelecomApiConfig = await telecomApiStorage.getConfig();
    if (dbTelecomApiConfig) {
      config = {
        ...config,
        telecomApi: dbTelecomApiConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取电信 API 配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 autojsApi 配置：从数据库读取
  try {
    const dbAutoJsApiConfig = await autojsApiStorage.getConfig();
    if (dbAutoJsApiConfig) {
      config = {
        ...config,
        autojsApi: dbAutoJsApiConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取 AutoJS API 配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 complianceCheckReport 配置：从数据库读取
  try {
    const dbComplianceReportConfig = await complianceReportConfigStorage.getConfig();
    if (dbComplianceReportConfig) {
      config = {
        ...config,
        complianceCheckReport: dbComplianceReportConfig,
      };
    }
  } catch (error) {
    logger.warn('从数据库读取合规性检查报告配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  // 特殊处理 ai 配置：从数据库读取 providers，并动态生成 providerOrder
  try {
    const dbProviders = await aiProviderStorage.getAllProviders();
    if (dbProviders && dbProviders.length > 0) {
      // 动态生成 providerOrder（按 priority 排序）
      const providerOrder = dbProviders.map(p => p.name);
      
      // 更新 config 对象
      config = {
        ...config,
        ai: {
          ...config.ai,
          providers: dbProviders,
          fallback: {
            ...config.ai?.fallback,
            providerOrder,
          },
        },
      };
    }
  } catch (error) {
    logger.warn('从数据库读取 AI 提供商配置失败，将使用文件配置:', error instanceof Error ? error.message : String(error));
  }
  
  return config;
}

/**
 * 获取指定分组的配置
 */
export async function getConfigGroup(group: string): Promise<Record<string, any> | null> {
  if (!CONFIG_GROUPS.includes(group as ConfigGroup)) {
    return null;
  }
  const config = await getAllConfig();
  const groupConfig = (config as any)[group] ?? null;
  
  // vehicleMonitor 的 token 已经在 getAllConfig 中处理
  return groupConfig;
}

/**
 * 更新指定分组的配置
 * 验证 → 临时文件 → 原子 rename → 发事件
 */
export async function updateConfigGroup(
  group: string,
  newValues: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!CONFIG_GROUPS.includes(group as ConfigGroup)) {
    return { success: false, error: `无效的配置分组：${group}` };
  }

  // 验证
  const validationError = validateConfigGroup(group, newValues);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // 获取写入锁
  if (writeLock) {
    return { success: false, error: '配置正在被其他操作修改，请稍后重试' };
  }

  writeLock = true;
  try {
    // 读取当前原始 YAML 内容
    const rawContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const fullConfig = yaml.parse(rawContent);

    // 保存旧配置用于回滚
    const oldGroupConfig = { ...fullConfig[group] };

    // 特殊处理 vehicleMonitor 配置：如果更新了 token，同时更新文件
    if (group === 'vehicleMonitor' && newValues.token) {
      const { updateToken } = require('../../services/vehicle-monitor-service');
      updateToken(newValues.token);
      // 从 newValues 中移除 token，避免写入配置文件
      const valuesToSave = { ...newValues };
      delete valuesToSave.token;
      fullConfig[group] = valuesToSave;
    } 
    // 特殊处理 api 配置：只更新数据库，不写回配置文件
    else if (group === 'api') {
      await apiConfigStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 comment 配置：只更新数据库，不写回配置文件
    else if (group === 'comment') {
      await commentConfigStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 post 配置：只更新数据库，不写回配置文件
    else if (group === 'post') {
      await postConfigStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 featuredPosting 配置：只更新数据库，不写回配置文件
    else if (group === 'featuredPosting') {
      await featuredPostingStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 scheduler 配置：只更新数据库，不写回配置文件
    else if (group === 'scheduler') {
      await schedulerConfigStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 contentLimits 配置：只更新数据库，不写回配置文件
    else if (group === 'contentLimits') {
      await contentLimitsStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 internetReference 配置：只更新数据库，不写回配置文件
    else if (group === 'internetReference') {
      await internetReferenceStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 contentDeduplication 配置：只更新数据库，不写回配置文件
    else if (group === 'contentDeduplication') {
      await contentDeduplicationStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 sensitiveWordFilter 配置：只更新数据库，不写回配置文件
    else if (group === 'sensitiveWordFilter') {
      await sensitiveWordFilterStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 contentQualityScoring 配置：只更新数据库，不写回配置文件
    else if (group === 'contentQualityScoring') {
      await contentQualityScoringStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 postingIntervalControl 配置：只更新数据库，不写回配置文件
    else if (group === 'postingIntervalControl') {
      await postingIntervalControlStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 vehicleMonitor 配置：只更新数据库，不写回配置文件
    else if (group === 'vehicleMonitor') {
      await vehicleMonitorStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 telecomApi 配置：只更新数据库，不写回配置文件
    else if (group === 'telecomApi') {
      await telecomApiStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 autojsApi 配置：只更新数据库，不写回配置文件
    else if (group === 'autojsApi') {
      await autojsApiStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 complianceCheckReport 配置：只更新数据库，不写回配置文件
    else if (group === 'complianceCheckReport') {
      await complianceReportConfigStorage.saveConfig(newValues as any);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    // 特殊处理 ai 配置：只更新数据库，不写回配置文件
    else if (group === 'ai' && newValues.providers) {
      await aiProviderStorage.saveProviders(newValues.providers);
      // 不更新 fullConfig[group]，保持配置文件干净
    } 
    else {
      // 其他配置（基础设施配置）：更新文件
      fullConfig[group] = newValues;
    }

    // 序列化为 YAML
    const newYamlContent = yaml.stringify(fullConfig, {
      lineWidth: 0,
      defaultKeyType: 'PLAIN',
      defaultStringType: 'QUOTE_DOUBLE',
    });

    // 原子写入：先写临时文件，再 rename
    const tempPath = CONFIG_PATH + '.tmp';
    fs.writeFileSync(tempPath, newYamlContent, 'utf-8');
    fs.renameSync(tempPath, CONFIG_PATH);

    logger.info(`配置分组 "${group}" 已更新`);

    // 重置缓存
    resetConfigCache();

    // 发出配置变更事件
    try {
      (configEvents as any).emit?.('configChanged', { group, oldConfig: oldGroupConfig, newConfig: newValues });
    } catch (reloadError) {
      // 热重载失败，回滚配置
      logger.error(`热重载失败，回滚配置分组 "${group}"`);
      fullConfig[group] = oldGroupConfig;
      const rollbackYaml = yaml.stringify(fullConfig, {
        lineWidth: 0,
        defaultKeyType: 'PLAIN',
        defaultStringType: 'QUOTE_DOUBLE',
      });
      fs.writeFileSync(CONFIG_PATH, rollbackYaml, 'utf-8');
      resetConfigCache();
      const errorMsg = reloadError instanceof Error ? reloadError.message : String(reloadError);
      return { success: false, error: `配置保存成功但热重载失败，已回滚: ${errorMsg}` };
    }

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`配置更新失败: ${errorMsg}`);
    return { success: false, error: `配置更新失败: ${errorMsg}` };
  } finally {
    writeLock = false;
  }
}
