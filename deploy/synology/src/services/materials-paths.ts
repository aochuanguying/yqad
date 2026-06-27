/**
 * 素材路径
 */

import { loadConfig } from '../utils/config';
import * as path from 'path';

/**
 * 获取素材路径列表
 */
export function getMaterialPaths(): string[] {
  return [];
}

/**
 * 获取素材处理后的路径
 */
export function getMaterialsProcessedPath(): string {
  const config = loadConfig();
  const processedPath = config.materials?.processedPath || config.materials?.basePath || './data/materials/processed';
  return path.resolve(process.cwd(), processedPath);
}

/**
 * 获取素材原始路径
 */
export function getMaterialsRawPath(): string {
  const config = loadConfig();
  const rawPath = config.materials?.rawPath || config.materials?.basePath || './data/materials/raw';
  return path.resolve(process.cwd(), rawPath);
}

/**
 * 获取素材处理配置
 */
export function getMaterialsProcessingConfig(): any {
  const config = loadConfig();
  return config.materials || {};
}
