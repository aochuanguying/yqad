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
 * 扫描 raw 目录，但通过路径转换来匹配数据库中的 processed 路径
 */
export async function scanMaterials(): Promise<MaterialScanResult> {
  const config = loadConfig();
  const rawPath = path.resolve(config.materials?.rawPath || './data/materials/raw');
  const processedPath = path.resolve(config.materials?.processedPath || './data/materials/processed');
  
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
    
    // 递归扫描 raw 目录所有文件
    const allFiles = await scanDirectory(rawPath);
    logger.info(`扫描到 ${allFiles.length} 个文件`);
    
    // 过滤支持的文件
    const supportedFiles = filterSupportedFiles(allFiles);
    logger.info(`过滤后支持的文件：${supportedFiles.length} 个`);
    
    result.totalScanned = supportedFiles.length;
    
    // 优化 1：批量加载现有素材路径，避免重复查询数据库
    logger.info('加载现有素材路径缓存...');
    const existingPaths = await loadExistingPaths();
    logger.info(`已加载 ${existingPaths.size} 个现有素材路径`);
    
    // 检查每个文件是否已存在（通过路径转换匹配数据库）
    for (const filePath of supportedFiles) {
      try {
        // 将 raw 路径转换为 processed 路径
        const relativePath = path.relative(rawPath, filePath);
        let processedFilePath = path.join(processedPath, relativePath);
        
        // 如果是 HEIC 文件，processed 路径应该是 .jpg 扩展名
        if (processedFilePath.toLowerCase().endsWith('.heic')) {
          processedFilePath = processedFilePath.replace(/\.heic$/i, '.jpg');
        }
        
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        const fileInfo: MaterialFileInfo = {
          path: filePath,
          hash: '', // 不再需要哈希
          size: stat.size,
          extension: ext,
        };
        
        // 检查 processed 路径是否已存在于数据库，并且文件确实存在
        const existsInDb = existingPaths.has(processedFilePath);
        const processedFileExists = fs.existsSync(processedFilePath);
        
        if (existsInDb && processedFileExists) {
          // 数据库有记录且文件存在，跳过
          result.existingMaterials.push(fileInfo);
          result.skippedCount++;
          logger.debug(`跳过已存在素材：${filePath} -> ${processedFilePath}`);
        } else {
          // 数据库无记录或文件已删除，需要重新处理
          result.newMaterials.push(fileInfo);
          result.newCount++;
          
          if (existsInDb && !processedFileExists) {
            // processed 文件已删除，先清理数据库旧记录
            logger.info(`检测到 processed 文件已删除，清理旧记录并重新处理：${filePath}`);
            try {
              await materialRecordStorage.deleteMaterialRecordByPath(processedFilePath);
              logger.info(`已删除旧记录：${processedFilePath}`);
            } catch (deleteError) {
              logger.warn(`删除旧记录失败：${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
            }
          } else if (!existsInDb) {
            logger.debug(`发现新素材：${filePath} (处理后路径：${processedFilePath})`);
          }
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
 * 批量加载现有素材的路径集合（用于去重检查）
 * 数据库保存的是 processed 路径，所以扫描时需要将 raw 路径转换为 processed 路径来比较
 */
async function loadExistingPaths(): Promise<Set<string>> {
  try {
    const allRecords = await materialRecordStorage.getAllMaterialRecords();
    const pathSet = new Set<string>();
    
    // 收集所有 processed 路径
    for (const record of allRecords) {
      if (record.path) {
        pathSet.add(record.path);
      }
    }
    
    logger.info(`加载现有素材路径：${pathSet.size} 个`);
    return pathSet;
  } catch (error) {
    logger.warn(`加载现有路径失败：${error instanceof Error ? error.message : String(error)}`);
    return new Set();
  }
}

/**
 * 检查是否为新素材（通过路径检查）
 * @deprecated 已废弃，使用 loadExistingHashes 批量加载
 */
export async function isNewMaterial(filePath: string): Promise<boolean> {
  try {
    const allRecords = await materialRecordStorage.getAllMaterialRecords();
    // 检查是否有相同路径的记录
    return allRecords.some(record => record.path === filePath);
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
