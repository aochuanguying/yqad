/**
 * 素材库路由
 * 
 * 提供素材文件的浏览、删除等接口（同步删除文件和数据库记录）
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../utils/config';
import { getMaterialRecordStorage } from '../../storage/mysql/material-record-storage';
import { manualOrganizeMaterials } from '../../services/material-organizer';
import { materialIndexRebuildService } from '../../services/material-index-rebuild-service';
import { getLogger } from '../../utils/logger';

const logger = getLogger('materials-routes');
const materialRecordStorage = getMaterialRecordStorage();
const router = Router();

/**
 * 递归获取目录下所有素材
 */
function getAllMaterialsFromDir(dirPath: string, basePath: string, imageExtensions: string[]): any[] {
  const items: any[] = [];
  
  if (!fs.existsSync(dirPath)) {
    return items;
  }
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  entries.forEach(entry => {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);
    
    if (entry.isDirectory()) {
      // 递归获取子目录的素材
      const subItems = getAllMaterialsFromDir(fullPath, basePath, imageExtensions);
      items.push(...subItems);
    } else if (imageExtensions.includes(path.extname(entry.name).toLowerCase())) {
      const stats = fs.statSync(fullPath);
      const dirname = path.dirname(relativePath);
      const directory = dirname === '.' ? '' : dirname;
      
      items.push({
        filename: entry.name,
        relativePath,
        directory,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
      });
    }
  });
  
  return items;
}

/**
 * GET /api/materials
 * 获取素材列表（支持分页和目录筛选）
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const processedPath = config.materials?.processedPath || './data/materials/processed';
    const dir = req.query.dir as string || '';
    
    // 基础路径
    const basePath = path.resolve(processedPath);
    
    // 安全检查
    if (dir && !path.resolve(basePath, dir).startsWith(basePath)) {
      return res.status(400).json({
        error: '无效的目录路径',
      });
    }
    
    const targetPath = dir ? path.resolve(basePath, dir) : basePath;
    
    // 检查目录是否存在
    if (!fs.existsSync(targetPath)) {
      return res.json({
        items: [],
        directories: [],
        currentDir: dir,
      });
    }
    
    // 过滤出图片
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    let items: any[] = [];
    const directories: string[] = [];
    
    // 始终获取所有一级子目录（用于前端下拉框）
    const rootEntries = fs.readdirSync(basePath, { withFileTypes: true });
    rootEntries.forEach(entry => {
      if (entry.isDirectory() && entry.name !== '.materials') {
        directories.push(entry.name);
      }
    });
    
    if (dir) {
      // 只读取当前目录的内容
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      entries.forEach(entry => {
        const fullPath = path.join(targetPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);
        
        if (entry.isDirectory()) {
          // 子目录的内容不显示
        } else if (imageExtensions.includes(path.extname(entry.name).toLowerCase())) {
          const stats = fs.statSync(fullPath);
          const dirname = path.dirname(relativePath);
          const directory = dirname === '.' ? '' : dirname;
          
          items.push({
            filename: entry.name,
            relativePath,
            directory,
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
          });
        }
      });
    } else {
      // 获取所有子目录的素材（递归）
      items = getAllMaterialsFromDir(basePath, basePath, imageExtensions);
    }
    
    // 按文件名排序
    items.sort((a, b) => (a.filename || '').localeCompare(b.filename || ''));
    
    res.json({
      items,
      directories,
      currentDir: dir,
    });
  } catch (error: any) {
    logger.error(`获取素材列表失败：${error.message}`);
    res.status(500).json({
      error: '获取素材列表失败',
      message: error.message,
    });
  }
});

/**
 * GET /api/materials/file/*
 * 获取素材文件（通过相对路径）
 */
router.get('/file/*', async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const processedPath = config.materials?.processedPath || './data/materials/processed';
    const basePath = path.resolve(processedPath);
    
    // 获取请求的路径部分
    const filePath = req.params[0];
    const fullPath = path.resolve(basePath, filePath);
    
    // 安全检查
    if (!fullPath.startsWith(basePath)) {
      return res.status(403).json({
        error: '禁止访问该路径',
      });
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        error: '文件不存在',
      });
    }
    
    // 发送文件
    res.sendFile(fullPath);
  } catch (error: any) {
    logger.error(`获取素材文件失败：${error.message}`);
    res.status(500).json({
      error: '获取素材文件失败',
      message: error.message,
    });
  }
});

/**
 * POST /api/materials/delete
 * 删除素材文件（同步删除数据库记录）
 */
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const processedPath = config.materials?.processedPath || './data/materials/processed';
    const basePath = path.resolve(processedPath);
    const { relativePath } = req.body;
    
    if (!relativePath) {
      return res.status(400).json({
        error: '缺少 relativePath 参数',
      });
    }
    
    const fullPath = path.resolve(basePath, relativePath);
    
    // 安全检查
    if (!fullPath.startsWith(basePath)) {
      return res.status(403).json({
        error: '禁止访问该路径',
      });
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        error: '文件不存在',
      });
    }
    
    // 1. 先删除数据库记录（同步删除 ChromaDB 向量）
    let dbDeleted = false;
    try {
      const deleted = await materialRecordStorage.deleteMaterialRecordByPath(fullPath);
      dbDeleted = deleted > 0;
      if (dbDeleted) {
        logger.info(`已删除数据库记录：${fullPath}`);
      }
    } catch (dbError) {
      logger.warn(`删除数据库记录失败：${dbError instanceof Error ? dbError.message : String(dbError)}`);
      // 不抛出，继续删除文件
    }
    
    // 2. 删除文件
    fs.unlinkSync(fullPath);
    
    logger.info(`素材文件已删除：${relativePath}${dbDeleted ? ' (含数据库记录)' : ''}`);
    res.json({
      success: true,
      message: '文件已删除',
      databaseRecordDeleted: dbDeleted,
    });
  } catch (error: any) {
    logger.error(`删除素材文件失败：${error.message}`);
    res.status(500).json({
      error: '删除素材文件失败',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/materials/file
 * 删除素材文件（仅删除文件，不同步数据库 - 已废弃，保留向后兼容）
 * @deprecated 使用 POST /api/materials/delete 代替
 */
router.delete('/file', async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const processedPath = config.materials?.processedPath || './data/materials/processed';
    const basePath = path.resolve(processedPath);
    const { relativePath } = req.body;
    
    if (!relativePath) {
      return res.status(400).json({
        error: '缺少 relativePath 参数',
      });
    }
    
    const fullPath = path.resolve(basePath, relativePath);
    
    // 安全检查
    if (!fullPath.startsWith(basePath)) {
      return res.status(403).json({
        error: '禁止访问该路径',
      });
    }
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        error: '文件不存在',
      });
    }
    
    // 删除文件
    fs.unlinkSync(fullPath);
    
    logger.warn(`素材文件已删除（但数据库记录未删除）：${relativePath}`);
    res.json({
      success: true,
      message: '文件已删除',
      warning: '数据库记录未删除，请使用新的 /api/materials/delete 接口',
    });
  } catch (error: any) {
    logger.error(`删除素材文件失败：${error.message}`);
    res.status(500).json({
      error: '删除素材文件失败',
      message: error.message,
    });
  }
});

/**
 * POST /api/materials/process
 * 整理素材（后台异步执行）
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    logger.info('素材整理请求已接收，后台异步执行');
    
    // 立即返回，后台异步执行
    setImmediate(async () => {
      try {
        const stats = await manualOrganizeMaterials();
        logger.info(`素材整理完成：扫描${stats.scanned}个，新增${stats.added}个，失败${stats.failed}个`);
      } catch (error: any) {
        logger.error(`素材整理失败：${error.message}`);
      }
    });
    
    res.json({
      success: true,
      message: '素材整理任务已启动，后台异步执行中',
    });
  } catch (error: any) {
    logger.error(`素材整理失败：${error.message}`);
    res.status(500).json({
      error: '素材整理失败',
      message: error.message,
    });
  }
});

/**
 * POST /api/materials/rebuild-index
 * 重建素材索引（后台异步执行）
 */
router.post('/rebuild-index', async (req: Request, res: Response) => {
  try {
    logger.info('收到素材索引重建请求，后台异步执行');
    
    const { mode, cleanExisting } = req.body;
    
    // 立即返回，后台异步执行
    setImmediate(async () => {
      try {
        if (mode === 'incremental') {
          logger.info('执行增量索引重建');
          const result = await materialIndexRebuildService.updateIncrementalIndex();
          logger.info(`增量索引重建完成：${result.message}`);
        } else {
          logger.info('执行全量索引重建');
          const result = await materialIndexRebuildService.rebuildAllIndexes({
            cleanExisting: cleanExisting !== false,
            batchSize: 50,
          });
          logger.info(`全量索引重建完成：${result.message}`);
        }
      } catch (error: any) {
        logger.error(`索引重建失败：${error.message}`);
      }
    });
    
    res.json({
      success: true,
      message: '索引重建任务已启动，后台异步执行中',
    });
    
  } catch (error: any) {
    logger.error(`索引重建失败：${error.message}`);
    res.status(500).json({
      success: false,
      error: '索引重建失败',
      message: error.message,
    });
  }
});

export default router;
