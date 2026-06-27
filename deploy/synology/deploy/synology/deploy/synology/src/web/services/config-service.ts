import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { AppConfig, loadConfig, resetConfigCache } from '../../utils/config';
import { getLogger } from '../../utils/logger';
import { configEvents } from './config-events';
import { validateConfigGroup } from './config-validator';
import { getVehicleTokenStorage } from '../../storage/redis/vehicle-token-storage';

const logger = getLogger('config-service');
const vehicleTokenStorage = getVehicleTokenStorage();

const CONFIG_PATH = path.resolve(process.cwd(), 'config/default.yaml');

// 配置分组名称列表
export const CONFIG_GROUPS = [
  'api', 'auth', 'ai', 'comment', 'post',
  'featuredPosting', 'analysis', 'scheduler', 'web', 'materials', 'contentLimits',
  'vehicleMonitor'
] as const;

export type ConfigGroup = typeof CONFIG_GROUPS[number];

// 内存写入锁
let writeLock = false;

/**
 * 获取全部配置
 */
export async function getAllConfig(): Promise<AppConfig> {
  resetConfigCache();
  const config = loadConfig();
  
  // 特殊处理 vehicleMonitor 配置：如果 Redis 中有 Token，优先返回 Redis 中的 Token
  try {
    const token = await vehicleTokenStorage.getToken();
    if (token && config.vehicleMonitor) {
      // 返回配置副本，并覆盖 token 字段
      return {
        ...config,
        vehicleMonitor: {
          ...config.vehicleMonitor,
          token,
        },
      };
    }
  } catch (error) {
    logger.warn('从 Redis 读取车辆 Token 失败:', error instanceof Error ? error.message : String(error));
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
    } else {
      // 更新指定分组
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
