/**
 * 素材处理器
 * 
 * 功能：
 * 1. 提取图片元数据（使用 sharp）
 * 2. AI 生成描述
 * 3. AI 生成标签
 * 4. 批量处理
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { generateContent } from '../ai/client';
import { getMaterialRecordStorage, CreateMaterialRecordInput } from '../storage/mysql/material-record-storage';
import { materialVectorStorage } from '../storage/chroma/material-vector-storage';
import { embeddingVectorizer } from '../utils/embedding-vectorizer';
import { aiProviderStorage } from '../storage/mysql/ai-provider-storage';
import { MaterialFileInfo, MaterialMetadata, MaterialProcessResult } from '../types/materials';

const execAsync = promisify(exec);

const logger = getLogger('material-processor');
const materialRecordStorage = getMaterialRecordStorage();

/**
 * 提取图片元数据
 */
export async function extractImageMetadata(filePath: string): Promise<MaterialMetadata | null> {
  try {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // HEIC 格式需要特殊处理
    if (ext === '.heic') {
      logger.info(`处理 HEIC 格式：${filePath}`);
      return await handleHeicFile(filePath, stat);
    }
    
    // 使用 sharp 提取元数据
    const metadata = await sharp(filePath).metadata();
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      fileSize: stat.size,
    };
  } catch (error) {
    logger.warn(`提取元数据失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 处理 HEIC 文件（群晖 Docker 兼容方案）
 * 注意：转换后的临时文件放在 raw 目录的 processed 子目录中，后续会复制到正确的 processed 目录
 */
async function handleHeicFile(filePath: string, stat: fs.Stats, targetProcessedPath?: string): Promise<MaterialMetadata | null> {
  // 转换后的临时文件放在 raw 目录的 .tmp 子目录中（避免与正式的 processed 目录混淆）
  const tempProcessedDir = path.join(path.dirname(filePath), '.tmp');
  const jpegPath = path.join(tempProcessedDir, `${path.basename(filePath, '.heic')}.jpg`);
  
  try {
    // 确保临时 processed 目录存在
    if (!fs.existsSync(tempProcessedDir)) {
      fs.mkdirSync(tempProcessedDir, { recursive: true });
    }
    
    // 检查是否已经转换过
    if (fs.existsSync(jpegPath)) {
      logger.debug(`使用已转换的 JPEG：${jpegPath}`);
      const metadata = await sharp(jpegPath).metadata();
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: 'jpeg',
        fileSize: stat.size,
        isHeic: true,
        convertedPath: jpegPath,
      };
    }
    
    // 使用 Python pillow-heif 库直接转换（对多层 HEIC 支持最好，成功率 100%）
    try {
      logger.debug(`[HEIC 转换] 使用 Python pillow-heif 转换：${filePath}`);
      // 使用临时文件方式执行 Python 脚本，避免路径包含特殊字符时的 shell 解析问题
      const tempScriptPath = `/tmp/heic_convert_${Date.now()}.py`;
      const pythonScript = `import pillow_heif
from PIL import Image
import sys

pillow_heif.register_heif_opener()

try:
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    img = Image.open(input_path)
    img.convert("RGB").save(output_path, "JPEG", quality=95)
    print("Success")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
`;
      fs.writeFileSync(tempScriptPath, pythonScript);
      try {
        await execAsync(`python3 ${tempScriptPath} "${filePath}" "${jpegPath}"`, { timeout: 60000 });
        logger.info(`[HEIC 转换] 成功：使用 Python pillow-heif 转换 HEIC 成功`);
        const metadata = await sharp(jpegPath).metadata();
        return {
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: 'jpeg',
          fileSize: stat.size,
          isHeic: true,
          convertedPath: jpegPath,
        };
      } finally {
        // 清理临时脚本文件
        try { fs.unlinkSync(tempScriptPath); } catch (e) {}
      }
    } catch (pythonError) {
      const errorMsg = pythonError instanceof Error ? pythonError.message : String(pythonError);
      logger.error(`[HEIC 转换] 失败 (Python pillow-heif): ${errorMsg}`);
      logger.error(`[HEIC 转换] 无法处理此文件，跳过：${filePath}`);
      return null;
    }
  } catch (error) {
    logger.error(`处理 HEIC 文件失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 为 Vision 分析准备图片：压缩至长边 ≤ 2048px、JPEG quality 85、转 base64
 */
export async function prepareImageForVision(filePath: string): Promise<string | null> {
  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();

    let pipeline = image;
    // 限制最大尺寸为 768px（平衡质量和请求体大小）
    const maxDim = 768;
    if ((metadata.width || 0) > maxDim || (metadata.height || 0) > maxDim) {
      pipeline = pipeline.resize(maxDim, maxDim, { fit: 'inside' });
    }

    const buffer = await pipeline.jpeg({ quality: 60 }).toBuffer();
    const base64 = buffer.toString('base64');

    // 检查大小（限制 base64 在 200KB 以内，确保整个请求体不超过上游限制）
    const sizeKB = base64.length / 1024;
    if (sizeKB > 200) {
      // 进一步压缩
      const smallerBuffer = await sharp(filePath)
        .resize(512, 512, { fit: 'inside' })
        .jpeg({ quality: 45 })
        .toBuffer();
      const smallerBase64 = smallerBuffer.toString('base64');
      
      if (smallerBase64.length / 1024 > 200) {
        logger.warn(`图片压缩后仍超过 200KB，跳过 Vision: ${filePath} (${(smallerBase64.length / 1024).toFixed(0)}KB)`);
        return null;
      }
      return smallerBase64;
    }

    return base64;
  } catch (error) {
    logger.error(`图片读取/编码失败: ${filePath}, ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * AI 生成描述
 * @param imageBase64 可选的 base64 图片数据，有值时使用 Vision 分析
 */
export async function generateDescription(filePath: string, metadata: MaterialMetadata, imageBase64?: string | null): Promise<string> {
  try {
    const fileName = path.basename(filePath);

    // 有图片时使用 Vision 增强 prompt
    if (imageBase64) {
      const systemPrompt = `你是图片描述专家。请根据图片内容进行视觉分析，生成 1-2 句自然语言描述。
要求：
1. 根据图片实际内容描述场景、物体、人物、氛围等
2. 使用中文，简洁生动
3. 适合用于语义搜索
4. 不要其他文字，只输出描述`;

      const userPrompt = `文件名：${fileName}
格式：${metadata.format}
尺寸：${metadata.width}x${metadata.height}
文件大小：${Math.round(metadata.fileSize / 1024)}KB

请根据图片内容生成图片描述。`;

      const response = await generateContent({
        systemPrompt,
        userPrompt,
        images: [imageBase64],
        requireVision: true,
        timeout: 60000,
      });

      const description = response.trim().replace(/^["']|["']$/g, '').slice(0, 200);
      logger.debug(`生成描述（Vision）：${description}`);
      return description;
    }

    // 无图片时走纯文件名推测
    const systemPrompt = `你是图片描述专家。根据文件名和图片信息生成 1-2 句自然语言描述。
要求：
1. 描述图片内容、场景、特点
2. 使用中文，简洁生动
3. 适合用于语义搜索
4. 不要其他文字，只输出描述`;

    const userPrompt = `文件名：${fileName}
格式：${metadata.format}
尺寸：${metadata.width}x${metadata.height}
文件大小：${Math.round(metadata.fileSize / 1024)}KB

请生成图片描述。`;

    const response = await generateContent({ systemPrompt, userPrompt });
    
    // 清理响应，去除多余文字
    const description = response.trim().replace(/^["']|["']$/g, '').slice(0, 200);
    
    logger.debug(`生成描述：${description}`);
    return description;
  } catch (error) {
    logger.warn(`生成描述失败，使用文件名降级：${error instanceof Error ? error.message : String(error)}`);
    // 降级方案：使用文件名
    return path.basename(filePath, path.extname(filePath));
  }
}

/**
 * AI 生成标签
 * @param imageBase64 可选的 base64 图片数据，有值时使用 Vision 分析
 */
export async function generateTags(filePath: string, metadata: MaterialMetadata, imageBase64?: string | null): Promise<string[]> {
  try {
    const fileName = path.basename(filePath);

    // 有图片时使用 Vision 增强 prompt
    if (imageBase64) {
      const systemPrompt = `你是标签生成专家。请根据图片内容进行视觉分析，为图片生成 3-5 个标签。
要求：
1. 根据图片实际内容涵盖场景、物体、情感维度
2. 每个标签单独一行
3. 只保留中文、英文、数字
4. 不要其他文字`;

      const userPrompt = `文件名：${fileName}
格式：${metadata.format}
尺寸：${metadata.width}x${metadata.height}

请根据图片内容生成 3-5 个标签，每个标签一行。`;

      const response = await generateContent({
        systemPrompt,
        userPrompt,
        images: [imageBase64],
        requireVision: true,
        timeout: 60000,
      });

      logger.debug(`AI 响应（Vision）：${response}`);

      const splitTags = response.split(/[\n\r,,]/)
        .map((t: string) => t.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '').replace(/^\[|\]$/g, ''))
        .map((t: string) => t.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ''))
        .filter((t: string) => t.trim().length > 0)
        .slice(0, 5);

      if (splitTags.length > 0) {
        logger.debug(`生成标签（Vision）：${splitTags.join(', ')}`);
        return splitTags;
      }

      // Vision 返回无效结果时降级为文件名
      logger.debug(`Vision 标签结果为空，使用降级方案：文件名分词`);
      return [path.basename(filePath, path.extname(filePath))];
    }

    // 无图片时走纯文件名推测
    const systemPrompt = `你是标签生成专家。为图片生成 3-5 个标签。
要求：
1. 涵盖场景、物体、情感维度
2. 每个标签单独一行
3. 只保留中文、英文、数字
4. 不要其他文字`;

    const userPrompt = `文件名：${fileName}
格式：${metadata.format}
尺寸：${metadata.width}x${metadata.height}

请生成 3-5 个标签，每个标签一行。`;

    const response = await generateContent({ systemPrompt, userPrompt });
    logger.debug(`AI 响应：${response}`);
    
    // 按换行符或逗号分割响应
    const splitTags = response.split(/[\n\r,,]/)
      .map((t: string) => t.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '').replace(/^\[|\]$/g, ''))
      .map((t: string) => t.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ''))
      .filter((t: string) => t.trim().length > 0)
      .slice(0, 5);
    
    if (splitTags.length > 0) {
      logger.debug(`生成标签：${splitTags.join(', ')}`);
      return splitTags;
    }
    
    // 降级方案：使用文件名分词
    logger.debug(`使用降级方案：文件名分词`);
    return [path.basename(filePath, path.extname(filePath))];
  } catch (error) {
    logger.warn(`生成标签失败：${error instanceof Error ? error.message : String(error)}`);
    return [path.basename(filePath, path.extname(filePath))];
  }
}

/**
 * 处理单个素材
 */
export async function processMaterial(fileInfo: MaterialFileInfo): Promise<MaterialProcessResult> {
  const startTime = Date.now();
  logger.info(`处理素材：${fileInfo.path}`);
  
  try {
    const config = loadConfig();
    const processedPath = config.materials?.processedPath || './data/materials/processed';
    const processedBasePath = path.resolve(processedPath);
    
    // 1. 提取元数据
    const metadata = await extractImageMetadata(fileInfo.path);
    if (!metadata) {
      logger.warn(`无法提取元数据或格式不支持，跳过：${fileInfo.path}`);
      return {
        id: '',
        path: fileInfo.path,
        metadata: { width: 0, height: 0, format: 'unknown', fileSize: fileInfo.size },
        description: '',
        tags: [],
        success: false,
        error: '无法提取元数据或格式不支持',
      };
    }
    
    // 2. 复制文件到 processed 目录
    // 计算相对路径和目标路径
    const relativePath = path.relative(path.resolve(config.materials?.rawPath || './data/materials/raw'), fileInfo.path);
    let destPath = path.join(processedBasePath, relativePath);
    
    // 如果是 HEIC 且已转换，需要修改目标路径的扩展名为.jpg
    if (metadata.isHeic && metadata.convertedPath) {
      // 将目标路径改为.jpg 扩展名
      destPath = destPath.replace(/\.heic$/i, '.jpg');
      const destDir = path.dirname(destPath);
      
      // 确保目标目录存在
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        logger.info(`创建目标目录：${destDir}`);
      }
      
      // 复制转换后的 JPEG 文件到 processed 目录
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(metadata.convertedPath, destPath);
        logger.info(`复制 HEIC 转换后的 JPEG 到 processed：${destPath}`);
        
        // 清理临时文件（raw 目录下的 .tmp 子目录中的转换文件）
        try {
          fs.unlinkSync(metadata.convertedPath);
          logger.debug(`清理临时转换文件：${metadata.convertedPath}`);
          
          // 尝试删除空的临时 .tmp 目录
          const tempProcessedDir = path.dirname(metadata.convertedPath);
          const files = fs.readdirSync(tempProcessedDir);
          if (files.length === 0) {
            fs.rmdirSync(tempProcessedDir);
            logger.debug(`清理空临时目录：${tempProcessedDir}`);
          }
        } catch (cleanupError) {
          logger.warn(`清理临时文件失败：${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
        }
      } else {
        logger.debug(`目标文件已存在，跳过复制：${destPath}`);
        
        // 清理临时文件（raw 目录下的 .tmp 子目录中的转换文件）
        try {
          fs.unlinkSync(metadata.convertedPath);
          const tempProcessedDir = path.dirname(metadata.convertedPath);
          const files = fs.readdirSync(tempProcessedDir);
          if (files.length === 0) {
            fs.rmdirSync(tempProcessedDir);
          }
        } catch (cleanupError) {
          // 忽略清理错误
        }
      }
      
      // 更新 metadata.format 为转换后的格式
      metadata.format = 'jpeg';
    } else {
      // 非 HEIC 文件，正常复制
      const destDir = path.dirname(destPath);
      
      // 确保目标目录存在
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        logger.info(`创建目标目录：${destDir}`);
      }
      
      // 复制原文件
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(fileInfo.path, destPath);
        logger.info(`复制文件到 processed：${destPath}`);
      } else {
        logger.debug(`目标文件已存在，跳过复制：${destPath}`);
      }
    }
    
    // 3. Vision 准备：检查是否启用 Vision 并准备图片 base64
    const enableVision = config.materials?.processing?.enableVision ?? false;
    let imageBase64: string | null = null;

    if (enableVision) {
      // 检查是否有可用的 vision provider
      const providers = await aiProviderStorage.getEnabledProviders();
      const hasVisionProvider = providers.some(p => p.supportsVision === true);
      if (hasVisionProvider) {
        imageBase64 = await prepareImageForVision(destPath); // 使用 processed 后的文件路径
      } else {
        logger.warn('enableVision=true 但无可用 vision provider，降级为纯文件名推测');
      }
    }

    // 4. AI 生成描述
    const description = await generateDescription(fileInfo.path, metadata, imageBase64);
    
    // 5. AI 生成标签
    const tags = await generateTags(fileInfo.path, metadata, imageBase64);
    logger.debug(`生成标签：${tags.join(', ')}`);
    
    // 6. 录入数据库（使用复制后的路径）
    const input: CreateMaterialRecordInput = {
      source: 'local',
      path: destPath, // 使用 processed 目录的路径
      url: undefined,
      qualityScore: null,
      matchedKeywords: tags,
      usageCount: 0,
      associatedPosts: [],
    };
    
    const record = await materialRecordStorage.upsertMaterialRecord(input);
    logger.info(`素材录入数据库：${record.id}`);
    
    // 7. 生成向量（如果 ChromaDB 已初始化）
    try {
      if (materialVectorStorage.isInitialized) {
        const vectorText = path.basename(fileInfo.path);
        const embedding = await embeddingVectorizer.generateEmbedding(vectorText);
        
        await materialVectorStorage.addVector(
          `material_${record.id}`,
          embedding,
          {
            file_path: record.path,
            file_name: path.basename(fileInfo.path),
          }
        );
        logger.info(`生成向量嵌入：material_${record.id}`);
      } else {
        logger.warn('ChromaDB 未初始化，跳过向量生成');
      }
    } catch (vectorError) {
      logger.warn(`生成向量失败：${vectorError instanceof Error ? vectorError.message : String(vectorError)}`);
      // 向量生成失败不影响主流程
    }
    
    const duration = Date.now() - startTime;
    logger.info(`素材处理完成：${fileInfo.path} (${duration}ms)`);
    
    return {
      id: record.id,
      path: fileInfo.path,
      metadata,
      description,
      tags,
      success: true,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`处理素材失败 ${fileInfo.path}: ${errorMsg}`);
    
    return {
      id: '',
      path: fileInfo.path,
      metadata: { width: 0, height: 0, format: 'unknown', fileSize: fileInfo.size },
      description: '',
      tags: [],
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * 批量处理素材
 */
export async function batchProcessMaterials(
  fileInfos: MaterialFileInfo[],
  batchSize: number = 50
): Promise<{
  results: MaterialProcessResult[];
  successCount: number;
  failedCount: number;
}> {
  const results: MaterialProcessResult[] = [];
  let successCount = 0;
  let failedCount = 0;
  
  logger.info(`批量处理素材：总计${fileInfos.length}个，每批最多${batchSize}个`);
  
  // 分批处理
  for (let i = 0; i < fileInfos.length; i += batchSize) {
    const batch = fileInfos.slice(i, i + batchSize);
    logger.info(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(fileInfos.length / batchSize)}`);
    
    // 串行处理批次内的素材（避免 AI 并发过高）
    for (const fileInfo of batch) {
      const result = await processMaterial(fileInfo);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }
    
    // 批次间延迟，避免 AI 服务限流
    if (i + batchSize < fileInfos.length) {
      logger.info('批次完成，暂停 1 秒...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  logger.info(`批量处理完成：成功${successCount}个，失败${failedCount}个`);
  
  return {
    results,
    successCount,
    failedCount,
  };
}

/**
 * 构建向量文本
 */
function buildVectorText(description: string, tags: string[], filePath: string): string {
  const fileName = path.basename(filePath);
  const parts = [
    fileName,
    description,
    tags.join(' '),
  ];
  return parts.filter(p => p.trim()).join(' ');
}
