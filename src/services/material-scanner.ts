/**
 * 素材扫描器
 * 
 * 功能：
 * 1. 递归扫描素材目录
 * 2. 计算文件哈希（SHA-256）
 * 3. 过滤支持的文件格式
 * 4. 检查是否为新素材
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { getMaterialRecordStorage } from '../storage/mysql/material-record-storage';
import { MaterialFileInfo, MaterialScanResult } from '../types/materials';

const logger = getLogger('material-scanner');
const materialRecordStorage = getMaterialRecordStorage();

/**
 * 支持的图片扩展名
 */
export const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic'];

/**
 * 扫描素材目录
 */
export async function scanMaterials(): Promise<MaterialScanResult> {
  const config = loadConfig();
  const rawPath = path.resolve(config.materials?.rawPath || './data/materials/raw');
  
  logger.info(`开始扫描素材目录：${rawPath}`);
  
  const result: MaterialScanResult = {
    newMaterials: [],
    existingMaterials: [],
    totalScanned: 0,
    newCount: 0,
    skippedCount: 0,
  };
  
  try {
    // 检查目录是否存在
    if (!fs.existsSync(rawPath)) {
      logger.warn(`素材目录不存在：${rawPath}`);
      return result;
    }
    
    // 递归扫描所有文件
    const allFiles = await scanDirectory(rawPath);
    logger.info(`扫描到 ${allFiles.length} 个文件`);
    
    // 过滤支持的文件
    const supportedFiles = filterSupportedFiles(allFiles);
    logger.info(`过滤后支持的文件：${supportedFiles.length} 个`);
    
    result.totalScanned = supportedFiles.length;
    
    // 优化 1：批量加载现有哈希，避免重复查询数据库
    logger.info('加载现有素材哈希缓存...');
    const existingHashes = await loadExistingHashes();
    logger.info(`已加载 ${existingHashes.size} 个现有哈希`);
    
    // 计算哈希并检查是否为新素材
    for (const filePath of supportedFiles) {
      try {
        const hash = await calculateFileHash(filePath);
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        const fileInfo: MaterialFileInfo = {
          path: filePath,
          hash,
          size: stat.size,
          extension: ext,
        };
        
        // 使用缓存检查是否已存在
        const exists = existingHashes.has(hash);
        
        if (exists) {
          result.existingMaterials.push(fileInfo);
          result.skippedCount++;
          logger.debug(`跳过已存在素材：${filePath}`);
        } else {
          result.newMaterials.push(fileInfo);
          result.newCount++;
          logger.debug(`发现新素材：${filePath}`);
        }
      } catch (error) {
        logger.warn(`处理文件失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    logger.info(
      `扫描完成：总计${result.totalScanned}个，新增${result.newCount}个，` +
      `跳过${result.skippedCount}个`
    );
    
    return result;
  } catch (error) {
    logger.error(`扫描素材目录失败：${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

/**
 * 递归扫描目录
 */
async function scanDirectory(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // 跳过隐藏文件和目录
      if (entry.name.startsWith('.')) {
        continue;
      }
      
      if (entry.isDirectory()) {
        // 递归扫描子目录
        const subFiles = await scanDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // 跳过符号链接
        if (entry.isSymbolicLink()) {
          continue;
        }
        files.push(fullPath);
      }
    }
  } catch (error) {
    logger.warn(`扫描目录失败 ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  return files;
}

/**
 * 过滤支持的文件格式
 */
function filterSupportedFiles(files: string[]): string[] {
  return files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  });
}

/**
 * 计算文件 SHA-256 哈希
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => {
      hash.update(data);
    });
    
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 批量加载现有素材的哈希集合（优化去重检查）
 */
async function loadExistingHashes(): Promise<Set<string>> {
  try {
    const allRecords = await materialRecordStorage.getAllMaterialRecords();
    const hashSet = new Set<string>();
    
    // 收集所有哈希（original_hash 和 processed_hash）
    for (const record of allRecords) {
      if (record.original_hash) {
        hashSet.add(record.original_hash);
      }
      if (record.processed_hash) {
        hashSet.add(record.processed_hash);
      }
    }
    
    return hashSet;
  } catch (error) {
    logger.warn(`加载现有哈希失败：${error instanceof Error ? error.message : String(error)}`);
    // 返回空集合，将导致所有文件被视为新素材（保守策略）
    return new Set();
  }
}

/**
 * 检查是否为新素材（通过哈希检查）
 * @deprecated 已废弃，使用 loadExistingHashes 批量加载
 */
export async function isNewMaterial(hash: string): Promise<boolean> {
  try {
    const allRecords = await materialRecordStorage.getAllMaterialRecords();
    // 检查是否有相同哈希的记录
    return allRecords.some(record => 
      record.original_hash === hash || record.processed_hash === hash
    );
  } catch (error) {
    logger.warn(`检查素材是否已存在失败：${error instanceof Error ? error.message : String(error)}`);
    // 查询失败时假设为新素材
    return false;
  }
}

/**
 * 从路径提取扩展名
 */
export function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * 检查是否是支持的扩展名
 */
export function isSupportedExtension(ext: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(ext.toLowerCase());
}
