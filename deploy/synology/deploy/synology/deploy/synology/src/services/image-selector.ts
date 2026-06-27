import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getLogger } from '../utils/logger';
import { getMaterialsProcessedPath } from './materials-paths';
import { loadMaterialIndex, SUPPORTED_IMAGE_EXTENSIONS } from './material-processing';

const logger = getLogger('image-selector');

// 字段权重配置
const FIELD_WEIGHTS = {
  tags: 3.0,
  intro: 2.0,
  directory: 1.5,
  filename: 1.0,
};

// 多角度维度关键词（用于精华帖选图）
const MULTI_ANGLE_KEYWORDS = {
  exterior: ['外观', '侧面', '前面', '后面', '车身', '整车', '外观图'],
  interior: ['内饰', '中控', '座椅', '方向盘', '仪表盘', '车内', '内部'],
  details: ['细节', '特写', '局部', '引擎', '轮胎', '轮毂', '车灯', '尾灯', '格栅'],
  scene: ['场景', '户外', '道路', '驾驶', '行驶', '停车', '自驾游', '风景']
};

// 高质量图片关键词
const QUALITY_KEYWORDS = ['高清', '实拍', '清晰', '原图', '大图', '4K', '高清大图'];

// Token 长度权重
function getTokenWeight(token: string): number {
  return token.length >= 3 ? 1.0 : 0.5;
}

// 辅助函数：提取中文字符序列
function extractChineseSequences(text: string): string[] {
  return text.match(/[\u4e00-\u9fff]+/g) || [];
}

/**
 * 基于种子的伪随机数生成器
 * 使用 MD5 哈希生成确定性随机数
 */
function seededRandom(seed: string): number {
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  // 取前 8 个字符转换为数字
  const num = parseInt(hash.substring(0, 8), 16);
  return (num % 10000) / 10000;
}

/**
 * 基于种子的稳定随机选择
 * 使用 Fisher-Yates 洗牌算法，确保相同种子下结果一致
 */
function seededSelect<T>(items: T[], seed: string, maxCount: number): T[] {
  if (items.length <= maxCount) return [...items];

  const shuffled = [...items];
  for (let i = 0; i < maxCount; i++) {
    const j = i + Math.floor(seededRandom(seed + i) * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, maxCount);
}

/**
 * 生成稳定随机种子
 * 格式：topicId-useCount-dateStr
 */
function generateStableSeed(topicId?: string, useCount?: number): string {
  const dateStr = new Date().toISOString().split('T')[0];
  if (topicId && useCount !== undefined) {
    return `${topicId}-${useCount}-${dateStr}`;
  }
  // 无 topic 时使用时间戳作为种子
  return `${Date.now()}-${Math.random()}`;
}

/**
 * 检测图片的角度类型
 * @param searchableText 图片的可搜索文本
 * @returns 角度类型数组
 */
function detectImageAngles(searchableText: string): string[] {
  const angles: string[] = [];
  const textLower = searchableText.toLowerCase();
  
  for (const [angleType, keywords] of Object.entries(MULTI_ANGLE_KEYWORDS)) {
    if (keywords.some(kw => textLower.includes(kw.toLowerCase()))) {
      angles.push(angleType);
    }
  }
  
  return angles;
}

/**
 * 检测图片质量等级
 * @param searchableText 图片的可搜索文本
 * @returns 质量评分（0-2）
 */
function detectImageQuality(searchableText: string): number {
  const textLower = searchableText.toLowerCase();
  let qualityScore = 0;
  
  // 包含质量关键词加分
  if (QUALITY_KEYWORDS.some(kw => textLower.includes(kw.toLowerCase()))) {
    qualityScore += 1;
  }
  
  // 包含多角度关键词加分
  const angles = detectImageAngles(searchableText);
  if (angles.length > 0) {
    qualityScore += Math.min(angles.length, 2); // 最多加 2 分
  }
  
  return qualityScore;
}

/**
 * 对主题方向文本进行分词
 * 按中文标点和常见分隔符切割，然后提取中文字符序列和非空词
 */
export function tokenize(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 按中文标点、英文标点和空白字符切割
  const delimiters = /[，。！？；：、,\.!\?;:\s\n\r\t]+/;
  const segments = text.split(delimiters).filter(s => s.length > 0);

  const keywords: Set<string> = new Set();

  for (const segment of segments) {
    // 整个 segment 作为一个关键词（如果包含中文）
    if (segment.length > 0) {
      keywords.add(segment);
    }

    // 如果 segment 较长（超过 2 个字符），也尝试提取每个连续的中文子序列
    // 提取连续中文字符序列
    const chineseMatches = segment.match(/[\u4e00-\u9fff]+/g);
    if (chineseMatches) {
      for (const match of chineseMatches) {
        keywords.add(match);
        // 对于较长的中文词（>2 字），也按 2 字切割作为额外关键词
        if (match.length > 2) {
          for (let i = 0; i <= match.length - 2; i++) {
            keywords.add(match.substring(i, i + 2));
          }
        }
      }
    }
  }

  return Array.from(keywords).filter(k => k.length > 0);
}

/**
 * 获取素材库基础路径
 */
function getBasePath(): string {
  return getMaterialsProcessedPath();
}

/**
 * 递归获取素材库中的所有目录路径（相对路径）
 */
function getAllDirectories(basePath: string): string[] {
  const dirs: string[] = [];

  function scan(currentPath: string) {
    if (!fs.existsSync(currentPath)) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);
        dirs.push(relativePath);
        scan(fullPath);
      }
    }
  }

  scan(basePath);
  return dirs;
}

/**
 * 获取目录下的直属图片文件（非递归）
 */
function getDirectImages(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const images: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
      images.push(path.join(dirPath, entry.name));
    }
  }

  return images;
}

function getAllImages(basePath: string): string[] {
  const images: string[] = [];
  images.push(...getDirectImages(basePath));
  const dirs = getAllDirectories(basePath);
  for (const dirRelPath of dirs) {
    const full = path.resolve(basePath, dirRelPath);
    images.push(...getDirectImages(full));
  }
  return images;
}

function selectImagesFromIndex(basePath: string, keywords: string, maxCount: number, isFeatured: boolean = false): string[] {
  const index = loadMaterialIndex();
  if (!index || index.items.length === 0) return [];
  const tokens = tokenize(keywords);
  if (tokens.length === 0) return [];

  // 加权匹配算法
  const scored = index.items
    .map((item: any) => {
      let score = 0;
      const searchText = (item.searchableText || '').toLowerCase();
      
      // 对每个 token 计算加权分数
      for (const token of tokens) {
        const tokenLower = token.toLowerCase();
        const tokenWeight = getTokenWeight(token);
        
        // 检查各个字段是否包含 token，并应用对应权重
        if (item.tags.some((tag: any) => tag.toLowerCase().includes(tokenLower))) {
          score += FIELD_WEIGHTS.tags * tokenWeight;
        }
        if (item.intro.toLowerCase().includes(tokenLower)) {
          score += FIELD_WEIGHTS.intro * tokenWeight;
        }
        if (item.directory.toLowerCase().includes(tokenLower)) {
          score += FIELD_WEIGHTS.directory * tokenWeight;
        }
        if (item.filename.toLowerCase().includes(tokenLower)) {
          score += FIELD_WEIGHTS.filename * tokenWeight;
        }
      }
      
      // 精华帖模式：增加多角度和质量权重
      if (isFeatured) {
        // 多角度覆盖加分（鼓励选取不同角度的图片）
        const angles = detectImageAngles(searchText);
        if (angles.length > 0) {
          score += angles.length * 0.5; // 每个角度加 0.5 分
        }
        
        // 高质量关键词加分
        const qualityScore = detectImageQuality(searchText);
        score += qualityScore * 0.3; // 质量分加权
      }
      
      return { item, score };
    })
    .filter((x: any) => x.score > 0)
    .sort((a: any, b: any) => b.score - a.score || a.item.relativePath.localeCompare(b.item.relativePath));

  if (scored.length === 0) {
    logger.info('素材索引无匹配结果');
    return [];
  }
  
  const bestScore = scored[0].score;
  const poolAll: string[] = scored.filter((x: any) => x.score === bestScore).map((x: any) => path.resolve(basePath, x.item.relativePath));
  const pool = poolAll.filter((p: string) => fs.existsSync(p));
  const dropped = poolAll.length - pool.length;
  if (dropped > 0) {
    logger.warn(`素材索引命中包含 ${dropped} 个失效路径，已跳过`);
  }
  if (pool.length === 0) {
    return [];
  }
  const selected = randomSelect(pool, maxCount);
  logger.info(`素材索引匹配 ${scored.length} 张，最高分 ${bestScore.toFixed(2)}，选取 ${selected.length} 张`);
  return selected;
}

/**
 * 从数组中随机选取最多 maxCount 个元素
 * @param items 待选数组
 * @param maxCount 最大选取数量
 * @param seed 可选种子，提供时生成确定性随机结果
 */
function randomSelect<T>(items: T[], maxCount: number, seed?: string): T[] {
  if (items.length <= maxCount) return [...items];

  if (seed !== undefined) {
    return seededSelect(items, seed, maxCount);
  }

  const shuffled = [...items];
  // Fisher-Yates shuffle (只需要前 maxCount 个)
  for (let i = 0; i < maxCount; i++) {
    const j = i + Math.floor(Math.random() * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, maxCount);
}

/**
 * 基于关键词从素材库选取图片
 * @param keywords 帖子主题方向文本（用于分词和目录匹配）
 * @param materialPaths 主题预配置的素材路径（非空时直接使用，跳过智能匹配）
 * @param isFeatured 是否为精华帖模式（影响选图策略）
 * @returns 选中图片的绝对路径数组，0-9 张
 */
export function selectImages(keywords: string, materialPaths?: string[], isFeatured: boolean = false): string[] {
  const basePath = getBasePath();

  // 当 materialPaths 非空时直接使用指定路径，跳过智能匹配
  if (materialPaths && materialPaths.length > 0) {
    logger.info(`使用指定素材路径：${materialPaths.join(', ')}`);
    const images: string[] = [];

    for (const matPath of materialPaths) {
      const fullPath = path.isAbsolute(matPath)
        ? matPath
        : path.resolve(basePath, matPath);

      if (!fs.existsSync(fullPath)) continue;

      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
          images.push(fullPath);
        }
      } else if (stat.isDirectory()) {
        images.push(...getDirectImages(fullPath));
      }
    }

    // 超过 9 张随机选取 9 张
    const selected = randomSelect(images, 9);
    logger.info(`指定路径共 ${images.length} 张图片，选取 ${selected.length} 张`);
    return selected;
  }

  // 智能匹配模式：对关键词进行分词
  const tokens = tokenize(keywords);
  if (tokens.length === 0) {
    logger.info('关键词分词结果为空，无法匹配素材目录');
    return [];
  }

  logger.info(`关键词分词结果：[${tokens.join(', ')}]`);

  const indexed = selectImagesFromIndex(basePath, keywords, 9, isFeatured);
  if (indexed.length > 0) {
    return indexed;
  }

  // 获取素材库所有目录
  const allDirs = getAllDirectories(basePath);
  if (allDirs.length === 0) {
    logger.info('素材库无子目录');
    return [];
  }

  // 遍历目录，计算每个目录的关键词命中数
  const dirHits: { relativePath: string; hitCount: number }[] = [];

  for (const dirRelPath of allDirs) {
    const dirName = path.basename(dirRelPath);
    let hitCount = 0;

    for (const token of tokens) {
      if (dirName.includes(token)) {
        hitCount++;
      }
    }

    if (hitCount > 0) {
      dirHits.push({ relativePath: dirRelPath, hitCount });
    }
  }

  if (dirHits.length === 0) {
    logger.info('无素材目录与关键词匹配');
    return [];
  }

  // 按命中关键词数降序排列
  dirHits.sort((a, b) => b.hitCount - a.hitCount);

  // 取命中最多的目录下的直属图片
  const bestDir = dirHits[0];
  const bestDirFullPath = path.resolve(basePath, bestDir.relativePath);
  const candidateImages = getDirectImages(bestDirFullPath);

  logger.info(`最佳匹配目录: "${bestDir.relativePath}" (命中 ${bestDir.hitCount} 个关键词), 共 ${candidateImages.length} 张图片`);

  if (candidateImages.length === 0) {
    return [];
  }

  // 超过9张随机选取9张
  const selected = randomSelect(candidateImages, 9);
  logger.info(`选取 ${selected.length} 张图片`);
  return selected;
}

export function selectFeaturedImageCandidates(params: {
  keywords: string;
  materialPaths?: string[];
  minCount: number;
  maxCandidates?: number;
  topicId?: string;
  useCount?: number;
}): string[] {
  const basePath = getBasePath();
  const maxCandidates = params.maxCandidates ?? 30;

  // 生成稳定随机种子
  const seed = generateStableSeed(params.topicId, params.useCount);

  // 精华帖模式：使用优化后的选图策略（多角度、高质量）
  const primary = selectImages(params.keywords, params.materialPaths, true);
  const selected: string[] = [...primary];

  if (selected.length >= params.minCount) {
    return selected.slice(0, Math.min(maxCandidates, selected.length));
  }

  // 按匹配分补图：从索引中继续选取下一批候选（精华模式）
  const index = loadMaterialIndex();
  if (index && index.items.length > 0) {
    const tokens = tokenize(params.keywords);
    if (tokens.length > 0) {
      // 重新计算匹配分（带多角度和质量加权）
      const scored = index.items
        .map((item: any) => {
          let score = 0;
          const searchText = (item.searchableText || '').toLowerCase();
          
          for (const token of tokens) {
            const tokenLower = token.toLowerCase();
            const tokenWeight = getTokenWeight(token);
            
            if (item.tags.some((tag: any) => tag.toLowerCase().includes(tokenLower))) {
              score += FIELD_WEIGHTS.tags * tokenWeight;
            }
            if (item.intro.toLowerCase().includes(tokenLower)) {
              score += FIELD_WEIGHTS.intro * tokenWeight;
            }
            if (item.directory.toLowerCase().includes(tokenLower)) {
              score += FIELD_WEIGHTS.directory * tokenWeight;
            }
            if (item.filename.toLowerCase().includes(tokenLower)) {
              score += FIELD_WEIGHTS.filename * tokenWeight;
            }
          }
          
          // 精华补图：增加多角度和质量权重
          const angles = detectImageAngles(searchText);
          if (angles.length > 0) {
            score += angles.length * 0.5;
          }
          
          const qualityScore = detectImageQuality(searchText);
          score += qualityScore * 0.3;
          
          return { item, score };
        })
        .filter((x: any) => x.score > 0 && !selected.includes(path.resolve(basePath, x.item.relativePath)))
        .sort((a: any, b: any) => b.score - a.score || a.item.relativePath.localeCompare(b.item.relativePath));

      if (scored.length > 0) {
        // 按匹配分继续选取下一批候选
        const needed = params.minCount - selected.length;
        const additional = scored.slice(0, Math.min(maxCandidates, needed + 8))
          .map((x: any) => path.resolve(basePath, x.item.relativePath));
        selected.push(...additional);
        logger.info(`精华补图：按匹配分补充 ${additional.length} 张图片`);
        return selected.slice(0, Math.min(maxCandidates, selected.length));
      }
    }
  }

  // 降级：无更多匹配候选时，从全库随机补图
  logger.warn('索引中无更多匹配候选，降级为全库随机补图');
  const allImages = getAllImages(basePath);
  const remainingPool = allImages.filter(p => !selected.includes(p));
  const needed = params.minCount - selected.length;

  const additional = randomSelect(remainingPool, Math.min(maxCandidates, needed + 8), seed);
  selected.push(...additional);

  return selected.slice(0, Math.min(maxCandidates, selected.length));
}
