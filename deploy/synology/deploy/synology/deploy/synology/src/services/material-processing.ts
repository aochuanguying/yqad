/**
 * 素材处理服务
 * 支持 HEIC 转 JPEG 的双链路处理：
 * - 主链路：sharp 直接解码
 * - 兜底链路：heif-convert 命令行工具
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import sharp from 'sharp';
import { getLogger } from '../utils/logger';
import { loadConfig } from '../utils/config';

const logger = getLogger('material-processing');

export interface ProcessedImage {
  path: string;
  width: number;
  height: number;
}

export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.HEIC'];

const config = loadConfig();
const heicFallbackConfig = config.materials.processing?.heicFallback || {};
const processingConfig = config.materials.processing || {};

/**
 * 使用 heif-convert 命令行工具转换 HEIC 到 JPEG
 */
async function convertWithHeifConvert(inputPath: string, outputPath: string): Promise<void> {
  const timeoutMs = heicFallbackConfig.timeoutMs || 30000;
  
  logger.debug(`使用 heif-convert 转换：${inputPath} -> ${outputPath}`);
  
  try {
    // heif-convert 的用法：heif-convert <input> <output>
    execFileSync('heif-convert', [inputPath, outputPath], {
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    logger.debug(`heif-convert 转换成功：${outputPath}`);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error('heif-convert 命令未找到，请确保已安装 libheif-examples 包');
    }
    
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`heif-convert 转换失败：${message}`);
  }
}

/**
 * 使用 sharp 进行二次处理（旋转调整和质量压缩）
 */
async function postProcessWithSharp(inputPath: string, outputPath: string): Promise<ProcessedImage> {
  const jpegQuality = processingConfig.jpegQuality || 82;
  
  logger.debug(`使用 sharp 处理：${inputPath} -> ${outputPath} (quality: ${jpegQuality})`);
  
  try {
    const image = sharp(inputPath);
    
    // 获取元数据
    const metadata = await image.metadata();
    
    // 处理图片：自动旋转 + JPEG 压缩
    await image
      .rotate() // 根据 EXIF 方向自动旋转
      .jpeg({ quality: jpegQuality })
      .toFile(outputPath);
    
    // 重新读取处理后的元数据
    const finalMetadata = await sharp(outputPath).metadata();
    
    logger.debug(`sharp 处理成功：${outputPath}, 尺寸：${finalMetadata.width}x${finalMetadata.height}`);
    
    return {
      path: outputPath,
      width: finalMetadata.width || 0,
      height: finalMetadata.height || 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`sharp 处理失败：${message}`);
  }
}

/**
 * 处理 HEIC 文件到 JPEG
 * 采用双链路策略：
 * 1. 主链路：sharp 直接解码 HEIC
 * 2. 兜底链路：heif-convert 命令行工具
 */
async function processHEIC(inputPath: string, outputPath: string): Promise<ProcessedImage> {
  const enableFallback = heicFallbackConfig.enabled !== false;
  
  logger.info(`开始处理 HEIC 文件：${path.basename(inputPath)}`);
  
  // 尝试主链路：sharp 直接解码
  try {
    logger.debug('尝试使用 sharp 直接解码 HEIC...');
    
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // 如果能成功获取元数据，说明 sharp 可以处理
    await image
      .rotate()
      .jpeg({ quality: processingConfig.jpegQuality || 82 })
      .toFile(outputPath);
    
    const finalMetadata = await sharp(outputPath).metadata();
    
    logger.info(`sharp 主链路成功：${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
    
    return {
      path: outputPath,
      width: finalMetadata.width || 0,
      height: finalMetadata.height || 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`sharp 主链路失败，尝试兜底链路：${message}`);
    
    if (!enableFallback) {
      throw new Error('sharp 处理失败且兜底功能已禁用');
    }
    
    // 兜底链路：heif-convert
    try {
      // 创建临时文件用于 heif-convert 的输出
      const tempPath = outputPath.replace('.jpg', '.temp.jpg');
      
      await convertWithHeifConvert(inputPath, tempPath);
      
      // 使用 sharp 进行二次处理（旋转和质量压缩）
      const result = await postProcessWithSharp(tempPath, outputPath);
      
      // 删除临时文件
      try {
        fs.unlinkSync(tempPath);
        logger.debug(`删除临时文件：${tempPath}`);
      } catch (e) {
        logger.warn(`删除临时文件失败 ${tempPath}: ${e instanceof Error ? e.message : String(e)}`);
      }
      
      logger.info(`heif-convert 兜底成功：${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
      
      return result;
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      logger.error(`HEIC 处理完全失败（主链路和兜底链路均失败）：${fallbackMessage}`);
      throw new Error(`HEIC 转换失败：${fallbackMessage}`);
    }
  }
}

/**
 * 处理普通图片（JPG/JPEG/PNG）
 * 直接复制或使用 sharp 重新编码
 */
async function processRegularImage(inputPath: string, outputPath: string): Promise<ProcessedImage> {
  const ext = path.extname(inputPath).toLowerCase();
  
  if (ext === '.png') {
    // PNG 转 JPEG
    logger.debug(`PNG 转 JPEG: ${path.basename(inputPath)}`);
    
    const result = await sharp(inputPath)
      .jpeg({ quality: processingConfig.jpegQuality || 82 })
      .toFile(outputPath);
    
    return {
      path: outputPath,
      width: result.width || 0,
      height: result.height || 0,
    };
  } else {
    // JPG/JPEG - 直接复制
    logger.debug(`复制 JPEG 文件：${path.basename(inputPath)}`);
    fs.copyFileSync(inputPath, outputPath);
    
    const metadata = await sharp(inputPath).metadata();
    
    return {
      path: outputPath,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  }
}

/**
 * 处理单个图片文件
 * @param inputPath 输入文件路径
 * @param outputPath 输出文件路径
 * @returns 处理后的图片信息
 */
export async function processImage(inputPath: string, outputPath?: string): Promise<ProcessedImage> {
  const ext = path.extname(inputPath).toLowerCase();
  
  // 如果没有指定输出路径，自动生成
  if (!outputPath) {
    const dir = path.dirname(inputPath);
    const base = path.basename(inputPath, ext);
    outputPath = path.join(dir, `${base}.jpg`);
  }
  
  // 确保输出目录存在
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    logger.debug(`创建输出目录：${outputDir}`);
  }
  
  // 根据扩展名选择处理方式
  if (ext === '.heic' || ext === '.HEIC') {
    return processHEIC(inputPath, outputPath);
  } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
    return processRegularImage(inputPath, outputPath);
  } else {
    throw new Error(`不支持的图片格式：${ext}`);
  }
}

export interface MaterialIndex {
  items: ProcessedImage[];
  basePath: string;
}

export function loadMaterialIndex(basePath?: string): MaterialIndex {
  const targetPath = basePath || config.materials.processedPath || './data/materials/processed';
  
  const items: ProcessedImage[] = [];
  
  if (fs.existsSync(targetPath)) {
    const files = fs.readdirSync(targetPath);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (['.jpg', '.jpeg'].includes(ext)) {
        const filePath = path.join(targetPath, file);
        items.push({
          path: filePath,
          width: 0,
          height: 0,
        });
      }
    }
  }
  
  return {
    items,
    basePath: targetPath,
  };
}

/**
 * 批量处理素材
 */
export interface ProcessMaterialsOptions {
  rawPath?: string;
  processedPath?: string;
  enableVision?: boolean;
  maxFiles?: number;
}

export interface ProcessMaterialsResult {
  scanned: number;
  processed: number;
  copied: number;
  converted: number;
  failed: number;
  ignored: number;
  skipped: number;
}

export async function processMaterials(options: ProcessMaterialsOptions = {}): Promise<ProcessMaterialsResult> {
  const stats: ProcessMaterialsResult = {
    scanned: 0,
    processed: 0,
    copied: 0,
    converted: 0,
    failed: 0,
    ignored: 0,
    skipped: 0,
  };
  
  const rawPath = options.rawPath || config.materials.rawPath || './data/materials/raw';
  const processedPath = options.processedPath || config.materials.processedPath || './data/materials/processed';
  const maxFiles = options.maxFiles || processingConfig.maxFilesPerRun || 1000;
  
  logger.info(`开始扫描和处理素材...`);
  logger.info(`原始目录：${rawPath}`);
  logger.info(`处理目录：${processedPath}`);
  
  // 确保目录存在
  if (!fs.existsSync(rawPath)) {
    logger.warn(`原始素材目录不存在：${rawPath}`);
    return stats;
  }
  
  if (!fs.existsSync(processedPath)) {
    fs.mkdirSync(processedPath, { recursive: true });
    logger.info(`创建处理后的素材目录：${processedPath}`);
  }
  
  // 扫描原始素材
  const files = fs.readdirSync(rawPath);
  stats.scanned = files.length;
  logger.info(`扫描到 ${files.length} 个素材文件`);
  
  let processedCount = 0;
  
  // 处理每个文件
  for (const file of files) {
    // 检查是否超过最大处理数量
    if (processedCount >= maxFiles) {
      logger.warn(`已达到最大处理数量限制 (${maxFiles})，剩余文件将跳过`);
      break;
    }
    
    try {
      const filePath = path.join(rawPath, file);
      const stat = fs.statSync(filePath);
      
      // 跳过目录
      if (stat.isDirectory()) {
        stats.ignored++;
        continue;
      }
      
      const ext = path.extname(file).toLowerCase();
      
      // 检查是否已处理
      const outputExt = (ext === '.heic' || ext === '.HEIC') ? '.jpg' : ext;
      const outputFile = file.replace(/\.(heic|HEIC)$/i, '.jpg');
      const processedFile = path.join(processedPath, outputFile);
      
      if (fs.existsSync(processedFile)) {
        stats.skipped++;
        logger.debug(`已处理，跳过：${file}`);
        continue;
      }
      
      // 处理文件
      const extLower = ext.toLowerCase();
      
      if (SUPPORTED_IMAGE_EXTENSIONS.includes(extLower)) {
        logger.info(`处理素材：${file}`);
        
        const result = await processImage(filePath, processedFile);
        
        stats.processed++;
        processedCount++;
        
        if (extLower === '.heic' || extLower === '.HEIC') {
          stats.converted++;
          logger.info(`HEIC 转换成功：${file} -> ${outputFile} (${result.width}x${result.height})`);
        } else if (extLower === '.png') {
          stats.copied++; // PNG 转 JPEG 也算 copied
          logger.info(`PNG 转换成功：${file} -> ${outputFile}`);
        } else {
          stats.copied++;
          logger.info(`JPEG 复制成功：${file}`);
        }
      } else {
        // 其他格式忽略
        stats.ignored++;
        logger.debug(`忽略未知格式：${file}`);
      }
    } catch (error) {
      stats.failed++;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`处理文件失败 ${file}: ${message}`);
    }
  }
  
  logger.info(
    `素材处理完成：扫描${stats.scanned}，处理${stats.processed}，转换${stats.converted}，` +
    `复制${stats.copied}，失败${stats.failed}，忽略${stats.ignored}，跳过${stats.skipped}`
  );
  
  return stats;
}
