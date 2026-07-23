/**
 * 素材整理调度器
 * 
 * 功能：
 * 1. 执行完整的素材整理 Pipeline
 * 2. 并发控制
 * 3. 统计和报告
 * 4. AI 降级素材补偿重试
 */

import { getLogger } from '../utils/logger';
import { scanMaterials } from './material-scanner';
import { batchProcessMaterials } from './material-processor';
import { MaterialOrganizeStats } from '../types/materials';
import { getMaterialRecordStorage } from '../storage/mysql/material-record-storage';
import { generateContent } from '../ai/client';
import { loadConfig } from '../utils/config';
import { AIProviderStorage } from '../storage/mysql/ai-provider-storage';
import * as path from 'path';
import * as fs from 'fs';

const logger = getLogger('material-organizer');

/**
 * 执行素材整理
 */
export async function organizeMaterials(): Promise<MaterialOrganizeStats> {
  const startTime = Date.now();
  logger.info('=== 开始执行素材整理 ===');
  
  const stats: MaterialOrganizeStats = {
    scanned: 0,
    added: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
  };
  
  try {
    // 1. 扫描素材目录
    logger.info('步骤 1: 扫描素材目录...');
    const scanResult = await scanMaterials();
    stats.scanned = scanResult.totalScanned;
    stats.skipped = scanResult.skippedCount;
    
    if (scanResult.newMaterials.length === 0) {
      logger.info('没有新素材，整理完成');
    } else {
      logger.info(`发现 ${scanResult.newMaterials.length} 个新素材`);
      
      // 2. 批量处理素材
      logger.info('步骤 2: 处理新素材...');
      const processResult = await batchProcessMaterials(scanResult.newMaterials);
      
      stats.added = processResult.successCount;
      stats.failed = processResult.failedCount;
    }
    
    // 3. 补偿降级素材
    logger.info('步骤 3: 检查降级素材补偿...');
    const compensated = await compensateDegradedMaterials();
    stats.updated = compensated;
    
    // 4. 生成报告
    stats.durationMs = Date.now() - startTime;
    
    logger.info('=== 素材整理完成 ===');
    logger.info(`统计：扫描${stats.scanned}个，新增${stats.added}个，补偿${stats.updated}个，跳过${stats.skipped}个，失败${stats.failed}个`);
    logger.info(`总耗时：${(stats.durationMs / 1000).toFixed(1)}秒`);
    
    return stats;
  } catch (error) {
    logger.error(`素材整理失败：${error instanceof Error ? error.message : String(error)}`);
    stats.durationMs = Date.now() - startTime;
    throw error;
  }
}

/**
 * 补偿降级处理的素材（AI 不可用时降级为文件名的记录）
 * 每次最多处理 10 个，避免长时间占用 AI 资源
 */
async function compensateDegradedMaterials(): Promise<number> {
  try {
    const storage = getMaterialRecordStorage();
    const degraded = await storage.getDegradedRecords(10);
    
    if (degraded.length === 0) {
      logger.info('无需补偿，所有素材标签正常');
      return 0;
    }
    
    logger.info(`发现 ${degraded.length} 个降级素材，尝试补偿...`);
    
    let compensatedCount = 0;
    
    for (const record of degraded) {
      try {
        // 检查文件是否存在
        if (!fs.existsSync(record.path)) {
          logger.warn(`补偿跳过：文件不存在 ${record.path}`);
          continue;
        }
        
        const fileName = path.basename(record.path);
        const config = loadConfig();
        const enableVision = config.materials?.processing?.enableVision ?? false;
        
        // 尝试用 Vision 生成标签
        let imageBase64: string | null = null;
        if (enableVision) {
          const providers = await AIProviderStorage.getInstance().getEnabledProviders();
          const hasVisionProvider = providers.some(p => p.supportsVision === true);
          if (hasVisionProvider) {
            try {
              const sharp = require('sharp');
              const buffer = await sharp(record.path)
                .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 60 })
                .toBuffer();
              const base64Str = buffer.toString('base64');
              // 确保不超过 200KB
              if (base64Str.length / 1024 <= 200) {
                imageBase64 = base64Str;
              } else {
                // 进一步压缩
                const smallerBuf = await sharp(record.path)
                  .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
                  .jpeg({ quality: 45 })
                  .toBuffer();
                const smallerB64 = smallerBuf.toString('base64');
                if (smallerB64.length / 1024 <= 200) {
                  imageBase64 = smallerB64;
                }
              }
            } catch (imgErr) {
              logger.debug(`补偿：图片压缩失败 ${fileName}，使用纯文本模式`);
            }
          }
        }
        
        // 生成标签
        const systemPrompt = imageBase64
          ? `你是标签生成专家。请根据图片内容生成 3-5 个中文标签。每个标签一行，不要其他文字。`
          : `你是标签生成专家。根据文件名推测图片内容，生成 3-5 个中文标签。每个标签一行，不要其他文字。`;
        
        const userPrompt = `文件名：${fileName}\n请生成 3-5 个标签。`;
        
        const response = await generateContent({
          systemPrompt,
          userPrompt,
          images: imageBase64 ? [imageBase64] : undefined,
          requireVision: !!imageBase64,
          timeout: 30000,
        });
        
        const tags = response.split(/[\n\r,,]/)
          .map((t: string) => t.trim().replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ''))
          .filter((t: string) => t.length > 0)
          .slice(0, 5);
        
        if (tags.length > 1 || (tags.length === 1 && tags[0] !== path.basename(record.path, path.extname(record.path)))) {
          // AI 返回了有效标签，更新记录
          await storage.updateKeywords(record.id, tags);
          compensatedCount++;
          logger.info(`补偿成功：${fileName} → [${tags.join(', ')}]`);
        } else {
          logger.debug(`补偿跳过：${fileName}，AI 仍返回无效结果`);
        }
        
        // 间隔避免限流
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        logger.warn(`补偿失败：${record.path} - ${err instanceof Error ? err.message : String(err)}`);
        // 单个失败不中断整体
        break; // AI 不可用时停止补偿，避免浪费请求
      }
    }
    
    if (compensatedCount > 0) {
      logger.info(`补偿完成：${compensatedCount}/${degraded.length} 个素材已更新标签`);
    }
    
    return compensatedCount;
  } catch (error) {
    logger.warn(`补偿逻辑异常：${error instanceof Error ? error.message : String(error)}`);
    return 0;
  }
}

/**
 * 手动触发素材整理（供 API 调用）
 */
export async function manualOrganizeMaterials(): Promise<MaterialOrganizeStats> {
  logger.info('手动触发素材整理请求');
  return organizeMaterials();
}
