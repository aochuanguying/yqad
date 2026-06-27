/**
 * 素材库路由
 * 
 * 提供素材文件的浏览、删除等接口
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../../utils/config';
import { getLogger } from '../../utils/logger';

const logger = getLogger('materials-routes');
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
 * DELETE /api/materials/file
 * 删除素材文件
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
    
    logger.info(`素材文件已删除：${relativePath}`);
    res.json({
      success: true,
      message: '文件已删除',
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
 * 整理素材（调用素材处理服务）
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    // TODO: 调用素材处理服务
    logger.info('素材整理请求已接收');
    res.json({
      success: true,
      message: '素材整理功能暂未实现',
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
 * 重建素材索引
 */
router.post('/rebuild-index', async (req: Request, res: Response) => {
  try {
    // TODO: 调用索引重建服务
    logger.info('索引重建请求已接收');
    res.json({
      success: true,
      message: '索引重建功能暂未实现',
    });
  } catch (error: any) {
    logger.error(`索引重建失败：${error.message}`);
    res.status(500).json({
      error: '索引重建失败',
      message: error.message,
    });
  }
});

export default router;
