import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from './config';
import { getLogger } from './logger';
import { ImageInfo } from '../types/api-remote-post';

const logger = getLogger('image-metadata');

/**
 * 生成图片元数据信息
 * @param imagePath 图片的绝对路径、相对路径或 HTTP/HTTPS URL
 * @returns 图片元数据信息
 */
export function generateImageMetadata(imagePath: string): ImageInfo {
  const config = loadConfig();
  
  // 如果是 HTTP/HTTPS URL，直接返回（网络素材）
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    const filename = path.basename(imagePath);
    logger.info(`网络素材：${imagePath}`);
    return {
      url: imagePath,
      relativePath: imagePath,
      filename,
      size: undefined,
    };
  }
  
  const basePathRaw = config.materials.processedPath || './data/materials/processed';
  const basePathResolved = path.resolve(basePathRaw);
  
  // 如果是相对路径，转换为绝对路径
  let absolutePath = imagePath;
  if (!path.isAbsolute(imagePath)) {
    absolutePath = path.resolve(basePathResolved, imagePath);
  }
  
  const absolutePathResolved = path.resolve(absolutePath);

  // 关键修复：如果 absolutePathResolved 已经包含 basePathResolved，直接使用
  // 避免路径重复拼接（如：/base/data/materials/processed/base/data/materials/processed/...）
  let finalBasePath = basePathResolved;
  if (absolutePathResolved.startsWith(basePathResolved) && absolutePathResolved !== basePathResolved) {
    // 路径已经在 basePath 下，直接使用
    finalBasePath = basePathResolved;
  } else if (absolutePathResolved.includes(basePathResolved)) {
    // 路径中包含了 basePath，可能是重复拼接，提取后面的部分
    const relativePart = absolutePathResolved.replace(basePathResolved, '').replace(/^[/\\]+/, '');
    absolutePath = path.join(basePathResolved, relativePart);
  }
  
  let relativePath = path.relative(finalBasePath, absolutePath).replace(/\\/g, '/');
  
  // 调试日志
  logger.info(`generateImageMetadata: imagePath=${imagePath}, basePathResolved=${finalBasePath}, absolutePath=${absolutePath}, relativePath=${relativePath}`);

  if (relativePath.startsWith('..')) {
    const filename = path.basename(absolutePathResolved);
    const tempDir = path.join(basePathResolved, 'temp-images');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const destPath = path.join(tempDir, filename);
    if (!fs.existsSync(destPath)) {
      try {
        fs.copyFileSync(absolutePathResolved, destPath);
      } catch (error: any) {
        logger.warn(`复制临时图片失败 ${absolutePathResolved} -> ${destPath}: ${error.message}`);
      }
    }

    relativePath = `temp-images/${filename}`;
  }
  
  // 生成下载 URL
  const url = generateImageUrl(relativePath);
  
  // 获取文件大小
  let size: number | undefined;
  try {
    const stat = fs.statSync(absolutePathResolved);
    size = stat.size;
  } catch (error: any) {
    logger.warn(`获取文件大小失败 ${absolutePathResolved}: ${error.message}`);
  }
  
  // 提取文件名
  const filename = path.basename(absolutePathResolved);
  
  return {
    url,
    relativePath,
    filename,
    size,
  };
}

/**
 * 生成图片下载 URL
 * @param relativePath 相对于素材库的路径
 * @returns 完整的下载 URL
 */
function generateImageUrl(relativePath: string): string {
  const config = loadConfig();

  const normalizedPath = relativePath.replace(/^\/+/, '');

  if (!config.web.baseUrl) {
    return `images/${normalizedPath}`;
  }

  const baseUrl = config.web.baseUrl.replace(/\/+$/, '');
  return `${baseUrl}/images/${normalizedPath}`;
}

/**
 * 批量生成图片元数据
 * @param imagePaths 图片路径数组
 * @returns 图片元数据数组
 */
export function generateBatchImageMetadata(imagePaths: string[]): ImageInfo[] {
  return imagePaths.map(generateImageMetadata);
}
