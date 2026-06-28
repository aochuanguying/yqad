/**
 * 混合素材服务
 * 
 * 功能：
 * 1. 本地素材优先级配置（本地优先/网络优先/混合模式）
 * 2. 基于互联网参考标题的智能匹配
 * 3. 素材混合策略（本地素材 + 网络素材组合）
 * 4. 素材质量评估（5 维度评分）
 * 5. 素材使用追溯
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { generateContent } from '../ai/client';
import { getMaterialRecordStorage, CreateMaterialRecordInput } from '../storage/mysql/material-record-storage';
import { chromaSearchService } from './chroma-search-service';

const logger = getLogger('hybrid-material');
const materialRecordStorage = getMaterialRecordStorage();

/**
 * 素材来源
 */
export type MaterialSource = 'local' | 'internet';

/**
 * 素材优先级模式
 */
export type PriorityMode = 'local-first' | 'internet-first' | 'hybrid';

/**
 * 素材质量评分
 */
export interface MaterialQualityScore {
  totalScore: number;      // 总分 (0-100)
  clarity: number;         // 清晰度 (0-20)
  composition: number;     // 构图 (0-20)
  lighting: number;        // 光线 (0-20)
  relevance: number;       // 相关性 (0-20)
  freshness: number;       // 新鲜度 (0-20)
}

/**
 * 素材记录
 */
export interface MaterialRecord {
  id: string;
  source: MaterialSource;
  path: string;            // 本地路径或网络 URL
  url?: string;            // CDN URL（本地素材上传后）
  qualityScore?: MaterialQualityScore;
  matchedKeywords?: string[];
  usageCount: number;
  lastUsedDate?: string;
  associatedPosts: string[];  // 关联的帖子 ID
  createdAt: string;
}

/**
 * 互联网参考帖子
 */
export interface InternetReference {
  title: string;
  content: string;
  source: string;
  url?: string;
  imageUrls?: string[];
  processedImageUrls?: string[];
}

/**
 * 素材选择结果
 */
export interface MaterialSelectionResult {
  selectedMaterials: MaterialRecord[];
  localCount: number;
  internetCount: number;
  totalScore: number;
  strategy: string;
}

/**
 * 混合素材服务类
 */
class HybridMaterialService {
  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    logger.info('混合素材服务初始化完成（使用 MySQL 存储）');
  }

  /**
   * 从互联网参考标题提取关键词
   */
  async extractKeywordsFromTitle(title: string): Promise<string[]> {
    const systemPrompt = `你是关键词提取专家。从标题中提取 3-5 个核心关键词。
要求：
1. 提取与主题最相关的词汇
2. 去除停用词（的、了、是、在等）
3. 输出 JSON 数组格式：["关键词 1", "关键词 2", ...]
4. 不要其他文字`;

    const userPrompt = `标题：${title}

请提取核心关键词。`;

    try {
      const response = await generateContent({ systemPrompt, userPrompt });
      
      // 尝试解析 JSON
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const keywords = JSON.parse(jsonMatch[0]);
        if (Array.isArray(keywords)) {
          logger.info(`从标题提取关键词：${keywords.join(', ')}`);
          return keywords;
        }
      }
      
      // 降级处理：简单分词
      const simpleKeywords = this.simpleTokenize(title);
      return simpleKeywords.slice(0, 5);
    } catch (error) {
      logger.warn(`提取关键词失败：${error instanceof Error ? error.message : String(error)}`);
      return this.simpleTokenize(title).slice(0, 5);
    }
  }

  /**
   * 简单分词（降级方案）
   */
  private simpleTokenize(text: string): string[] {
    // 中文按 2-3 字分词，英文按单词分词
    const chineseWords = text.match(/[\u4e00-\u9fa5]{2,3}/g) || [];
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    
    // 去除常见停用词
    const stopwords = ['的', '了', '是', '在', '和', '与', '及', '等', '个', '这', '那'];
    return [...chineseWords, ...englishWords].filter(w => !stopwords.includes(w));
  }

  /**
   * 智能匹配本地素材（支持语义搜索）
   */
  async matchLocalMaterials(
    keywords: string[],
    neededCount: number
  ): Promise<MaterialRecord[]> {
    logger.info(`matchLocalMaterials: 开始匹配，关键词=[${keywords.join(', ')}], 需要数量=${neededCount}`);
    
    const config = loadConfig();
    const basePathRaw = config.materials?.basePath || './data/materials/processed';
    const basePath = path.resolve(basePathRaw);  // 转换为绝对路径
    
    logger.info(`matchLocalMaterials: basePathRaw=${basePathRaw}, basePath=${basePath}`);
    
    // 【新增】尝试使用 ChromaDB 语义搜索
    try {
      const query = keywords.join(' ');
      logger.info(`【语义搜索】使用 ChromaDB 搜索素材：${query}`);
      
      const searchResults = await chromaSearchService.searchMaterials({
        query,
        nResults: neededCount * 2,  // 多返回一些用于筛选
        minSimilarity: 0.5,
      });
      
      if (searchResults.length > 0) {
        logger.info(`【语义搜索】找到 ${searchResults.length} 个匹配素材`);
        
        // 转换为 MaterialRecord
        const materials: MaterialRecord[] = [];
        for (const result of searchResults) {
          try {
            const dbRecord = await materialRecordStorage.getMaterialRecordById(result.id);
            if (dbRecord) {
              // 转换 MySQL 记录到服务接口
              const record: MaterialRecord = {
                id: dbRecord.id,
                source: dbRecord.source,
                path: dbRecord.path,
                url: dbRecord.url,
                qualityScore: dbRecord.quality_score || {
                  totalScore: 0,
                  clarity: 0,
                  composition: 0,
                  lighting: 0,
                  relevance: 0,
                  freshness: 0,
                },
                matchedKeywords: dbRecord.matched_keywords,
                usageCount: dbRecord.usage_count,
                lastUsedDate: dbRecord.last_used_date?.toISOString(),
                associatedPosts: dbRecord.associated_posts || [],
                createdAt: dbRecord.created_at.toISOString(),
              };
              materials.push(record);
            }
          } catch (error) {
            logger.warn(`获取素材记录失败 ${result.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        if (materials.length > 0) {
          logger.info(`【语义搜索】成功加载 ${materials.length} 个素材`);
          return materials.slice(0, neededCount);
        }
      } else {
        logger.info(`【语义搜索】无匹配结果，回退到关键词匹配`);
      }
    } catch (error) {
      logger.warn(`【语义搜索】失败，回退到关键词匹配：${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 回退到原有的关键词匹配逻辑
    logger.info(`matchLocalMaterials: 使用关键词匹配逻辑`);
    
    // 获取所有本地素材（从 MySQL）
    const localMaterials = await this.scanLocalMaterialsFromMySQL();
    logger.info(`matchLocalMaterials: 从 MySQL 加载到 ${localMaterials.length} 个本地素材`);
    
    if (localMaterials.length === 0) {
      logger.warn('matchLocalMaterials: 未找到本地素材');
      return [];
    }

    // 计算匹配分数
    logger.info(`matchLocalMaterials: 开始计算匹配分数...`);
    const scoredMaterials = localMaterials.map(material => {
      const matchScore = this.calculateMatchScore(material, keywords);
      const qualityScore = material.qualityScore?.totalScore || 50;
      
      // 综合分数 = 匹配度 60% + 质量 40%
      const totalScore = matchScore * 0.6 + qualityScore * 0.4;
      
      return {
        material,
        totalScore,
        matchScore,
        qualityScore,
      };
    });

    // 按分数降序排序
    scoredMaterials.sort((a, b) => b.totalScore - a.totalScore);
    
    // 输出前 10 个匹配结果用于调试
    logger.info(`matchLocalMaterials: 匹配分数 TOP 10:`);
    scoredMaterials.slice(0, 10).forEach((item, index) => {
      logger.info(`  #${index + 1}: ${item.material.path} - 总分=${item.totalScore.toFixed(1)}, 匹配=${item.matchScore.toFixed(1)}, 质量=${item.qualityScore}`);
    });

    // 选择前 N 个
    const selected = scoredMaterials.slice(0, neededCount);
    
    logger.info(
      `matchLocalMaterials: 智能匹配完成，关键词=[${keywords.join(', ')}], ` +
      `选中${selected.length}个素材，平均分数=${selected.length > 0 ? (selected.reduce((sum, s) => sum + s.totalScore, 0) / selected.length).toFixed(1) : 'N/A'}`
    );

    return selected.map(s => s.material);
  }

  /**
   * 从 MySQL 扫描本地素材
   */
  private async scanLocalMaterialsFromMySQL(): Promise<MaterialRecord[]> {
    const materials: MaterialRecord[] = [];
    logger.info(`scanLocalMaterialsFromMySQL: 开始从 MySQL 加载本地素材`);
    
    try {
      const allRecords = await materialRecordStorage.getAllMaterialRecords();
      
      for (const dbRecord of allRecords) {
        if (dbRecord.source === 'local') {
          const record: MaterialRecord = {
            id: dbRecord.id,
            source: 'local',
            path: dbRecord.path,
            url: dbRecord.url,
            usageCount: dbRecord.usage_count,
            lastUsedDate: dbRecord.last_used_date?.toISOString(),
            associatedPosts: dbRecord.associated_posts || [],
            createdAt: dbRecord.created_at.toISOString(),
          };
          materials.push(record);
        }
      }
      
      logger.info(`scanLocalMaterialsFromMySQL: 加载完成，共 ${materials.length} 个本地素材`);
    } catch (error) {
      logger.error(`scanLocalMaterialsFromMySQL: 加载本地素材失败：${error instanceof Error ? error.message : String(error)}`);
    }
    
    return materials;
  }

  /**
   * 检查是否为图片文件
   */
  private isImageFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'].includes(ext);
  }

  /**
   * 计算匹配分数
   */
  private calculateMatchScore(material: MaterialRecord, keywords: string[]): number {
    // 如果有关键词记录，计算匹配度
    if (material.matchedKeywords && material.matchedKeywords.length > 0) {
      const matchCount = keywords.filter(k => 
        material.matchedKeywords!.some(mk => mk.includes(k) || k.includes(mk))
      ).length;
      
      return (matchCount / keywords.length) * 100;
    }
    
    // 如果没有关键词记录，使用路径作为简单匹配依据
    const pathLower = material.path.toLowerCase();
    const matchCount = keywords.filter(k => pathLower.includes(k.toLowerCase())).length;
    
    return (matchCount / keywords.length) * 100;
  }

  /**
   * 下载网络图片到本地（支持重定向）
   */
  private async downloadImageToTemp(url: string, maxRedirects: number = 3): Promise<string | null> {
    logger.info(`downloadImageToTemp: 开始下载 ${url}`);
    
    const config = loadConfig();
    const tempDir = path.resolve(config.materials.processedPath || './data/materials/processed', 'temp-images');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      logger.info(`downloadImageToTemp: 创建临时目录 ${tempDir}`);
    }
    
    // 使用临时文件名，下载成功后再重命名
    const tempFilename = `net_${Date.now()}_temp`;
    const tempPath = path.join(tempDir, tempFilename);
    logger.info(`downloadImageToTemp: 临时路径 ${tempPath}`);
    
    return new Promise((resolve, reject) => {
      this.downloadWithRedirects(url, tempPath, maxRedirects, (downloadedPath) => {
        if (!downloadedPath) {
          resolve(null);
          return;
        }
        
        // 下载成功，重命名为带扩展名的文件名
        try {
          const extension = this.extractImageExtension(url);
          const finalFilename = `net_${Date.now()}${extension}`;
          const finalPath = path.join(tempDir, finalFilename);
          
          fs.renameSync(downloadedPath, finalPath);
          logger.info(`downloadImageToTemp: 重命名为 ${finalPath}`);
          resolve(finalPath);
        } catch (error: any) {
          logger.warn(`重命名下载文件失败：${error.message}`);
          resolve(downloadedPath);  // 使用原路径
        }
      });
    });
  }
  
  /**
   * 从 URL 提取图片扩展名
   */
  private extractImageExtension(url: string): string {
    // 尝试从 URL 路径中提取扩展名
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const ext = path.extname(pathname).toLowerCase();
      
      // 检查是否是有效的图片扩展名
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'].includes(ext)) {
        return ext;
      }
    } catch (error) {
      // URL 解析失败，使用默认扩展名
    }
    
    // 默认使用 .jpg
    return '.jpg';
  }
  
  /**
   * 下载网络图片（处理重定向）
   */
  private downloadWithRedirects(
    url: string, 
    tempPath: string, 
    maxRedirects: number,
    callback: (result: string | null) => void
  ): void {
    const client = url.startsWith('https') ? https : http;
    logger.info(`downloadWithRedirects: 使用 ${url.startsWith('https') ? 'HTTPS' : 'HTTP'} 客户端，${url}`);
    
    client.get(url, (res) => {
      logger.info(`downloadWithRedirects: 响应状态码 ${res.statusCode}`);
      
      // 处理重定向 (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.statusCode!)) {
        const location = res.headers.location;
        if (location && maxRedirects > 0) {
          logger.info(`downloadWithRedirects: 重定向到 ${location} (剩余重试次数：${maxRedirects - 1})`);
          // 处理相对路径
          const redirectUrl = location.startsWith('http') ? location : new URL(location, url).href;
          this.downloadWithRedirects(redirectUrl, tempPath, maxRedirects - 1, callback);
        } else {
          logger.warn(`下载网络图片失败 ${url}: 重定向次数耗尽或无 Location 头`);
          callback(null);
        }
        return;
      }
      
      if (res.statusCode !== 200) {
        logger.warn(`下载网络图片失败 ${url}: ${res.statusCode}`);
        callback(null);
        return;
      }
      
      const file = fs.createWriteStream(tempPath);
      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        logger.info(`网络图片已下载到临时文件：${url} -> ${tempPath}`);
        callback(tempPath);
      });
    }).on('error', (err) => {
      logger.warn(`下载网络图片出错 ${url}: ${err.message}`);
      callback(null);
    });
  }

  /**
   * 处理互联网参考素材
   */
  async processInternetReferences(
    references: InternetReference[]
  ): Promise<MaterialRecord[]> {
    const records: MaterialRecord[] = [];
    logger.info(`processInternetReferences: 开始处理 ${references.length} 篇参考帖子`);
    
    for (const ref of references) {
      // 优先使用去水印后的图片
      const imageUrls = ref.processedImageUrls || ref.imageUrls || [];
      logger.info(`processInternetReferences: 处理参考帖子 "${ref.title}", 图片数=${imageUrls.length}`);
      
      for (const url of imageUrls) {
        // 下载网络图片到本地
        const localPath = await this.downloadImageToTemp(url);
        logger.info(`downloadImageToTemp: 下载结果 localPath=${localPath ? '成功' : '失败'}`);
        
        const record: MaterialRecord = {
          id: `internet_${Buffer.from(url).toString('base64')}`,
          source: 'internet',
          path: localPath || url,  // 下载失败则使用原 URL
          url: localPath ? undefined : url,
          usageCount: 0,
          associatedPosts: [],
          createdAt: new Date().toISOString(),
        };
        
        records.push(record);
      }
    }
    
    logger.info(`处理互联网素材 ${records.length} 个`);
    return records;
  }

  /**
   * 选择混合素材
   * ⭐ 优化逻辑：按贴合度排序选择，不强制要求两种素材同时存在
   */
  async selectHybridMaterials(
    options: {
      priorityMode?: PriorityMode;
      localRatio?: number;       // 本地素材比例 (0-1)
      internetReferences?: InternetReference[];
      neededCount: number;
      title?: string;
    }
  ): Promise<MaterialSelectionResult> {
    const config = loadConfig();
    const priorityMode = options.priorityMode || 'hybrid';
    const localRatio = options.localRatio ?? 0.6;  // 默认 60% 本地素材
    const neededCount = options.neededCount;

    logger.info(
      `选择混合素材：模式=${priorityMode}, 本地比例=${localRatio}, ` +
      `需要数量=${neededCount}`
    );

    let localMaterials: MaterialRecord[] = [];
    let internetMaterials: MaterialRecord[] = [];

    // 1. 如果有标题，提取关键词并匹配本地素材
    if (options.title) {
      const keywords = await this.extractKeywordsFromTitle(options.title);
      localMaterials = await this.matchLocalMaterials(keywords, neededCount);
    }

    // 2. 处理互联网参考素材
    if (options.internetReferences && options.internetReferences.length > 0) {
      internetMaterials = await this.processInternetReferences(options.internetReferences);
    }

    // 3. ⭐ 优化选择逻辑：按贴合度排序，不强制混合
    let selected: MaterialRecord[] = [];
    let strategy = '';

    if (priorityMode === 'local-first') {
      // 本地优先：全部使用本地素材，不足时用网络素材补充
      selected = [...localMaterials];
      if (selected.length < neededCount && internetMaterials.length > 0) {
        const needExtra = neededCount - selected.length;
        selected = selected.concat(internetMaterials.slice(0, needExtra));
        strategy = `本地优先：本地${localMaterials.length}个 + 网络补充${Math.min(needExtra, internetMaterials.length)}个`;
      } else {
        strategy = `本地优先：全部${selected.length}个本地素材`;
      }
    } else if (priorityMode === 'internet-first') {
      // 网络优先：全部使用网络素材，不足时用本地素材补充
      selected = [...internetMaterials];
      if (selected.length < neededCount && localMaterials.length > 0) {
        const needExtra = neededCount - selected.length;
        selected = selected.concat(localMaterials.slice(0, needExtra));
        strategy = `网络优先：网络${internetMaterials.length}个 + 本地补充${Math.min(needExtra, localMaterials.length)}个`;
      } else {
        strategy = `网络优先：全部${selected.length}个网络素材`;
      }
    } else {
      // 混合模式：按贴合度排序选择，不强制要求两种素材同时存在
      logger.info(`混合模式：收集到本地${localMaterials.length}个，网络${internetMaterials.length}个候选素材`);
      
      // 合并所有候选素材
      const allCandidates = [...localMaterials, ...internetMaterials];
      
      if (allCandidates.length === 0) {
        strategy = '混合模式：无可用素材';
        selected = [];
      } else if (allCandidates.length <= neededCount) {
        // 候选素材不足，全部使用
        selected = allCandidates;
        const localCount = selected.filter(m => m.source === 'local').length;
        const internetCount = selected.filter(m => m.source === 'internet').length;
        strategy = `混合模式：候选不足，使用全部${selected.length}个（本地${localCount}+网络${internetCount}）`;
      } else {
        // 候选素材充足，按贴合度排序选择前 N 个
        // 本地素材有 matchScore，网络素材默认质量分为 60
        const scoredCandidates = allCandidates.map(material => {
          const matchScore = material.matchedKeywords ? 
            this.calculateMatchScore(material, options.title ? [options.title] : []) : 0;
          const qualityScore = material.qualityScore?.totalScore || 60;
          
          // 综合分数 = 匹配度 70% + 质量 30%
          const totalScore = matchScore * 0.7 + qualityScore * 0.3;
          
          return {
            material,
            totalScore,
            matchScore,
            qualityScore,
          };
        });
        
        // 按综合分数降序排序
        scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
        
        // 输出前 10 个匹配结果用于调试
        logger.info(`混合模式：贴合度 TOP ${Math.min(10, scoredCandidates.length)}:`);
        scoredCandidates.slice(0, 10).forEach((item, index) => {
          logger.info(`  #${index + 1}: ${item.material.path} - 总分=${item.totalScore.toFixed(1)}, 匹配=${item.matchScore.toFixed(1)}, 质量=${item.qualityScore}`);
        });
        
        // 选择前 N 个最贴合的
        selected = scoredCandidates.slice(0, neededCount).map(s => s.material);
        
        const localCount = selected.filter(m => m.source === 'local').length;
        const internetCount = selected.filter(m => m.source === 'internet').length;
        
        // 策略描述：说明选择了多少个，本地和网络各多少
        if (localCount === 0) {
          strategy = `混合模式：选择最贴合的${selected.length}个（全部网络素材）`;
        } else if (internetCount === 0) {
          strategy = `混合模式：选择最贴合的${selected.length}个（全部本地素材）`;
        } else {
          strategy = `混合模式：选择最贴合的${selected.length}个（本地${localCount}+网络${internetCount}）`;
        }
      }
    }

    // 限制总数（再次确认）
    selected = selected.slice(0, neededCount);

    // 计算统计
    const localCount = selected.filter(m => m.source === 'local').length;
    const internetCount = selected.filter(m => m.source === 'internet').length;
    const totalScore = selected.reduce(
      (sum, m) => sum + (m.qualityScore?.totalScore || 50), 
      0
    );

    logger.info(
      `素材选择完成：总计${selected.length}个，本地${localCount}个，` +
      `网络${internetCount}个，策略="${strategy}"`
    );

    return {
      selectedMaterials: selected,
      localCount,
      internetCount,
      totalScore,
      strategy,
    };
  }

  /**
   * 更新素材使用记录
   */
  async updateMaterialUsage(
    materialIds: string[],
    postId: string
  ): Promise<void> {
    const now = new Date();
    
    for (const id of materialIds) {
      try {
        // 从 MySQL 获取记录
        const dbRecord = await materialRecordStorage.getMaterialRecordById(id);
        if (dbRecord) {
          // 更新使用次数
          await materialRecordStorage.incrementUsedCount(id);
          logger.debug(`已更新素材使用次数：${id}`);
        }
      } catch (error) {
        logger.warn(`更新素材使用记录失败 ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    logger.debug(`已更新 ${materialIds.length} 个素材的使用记录`);
  }

  /**
   * 评估素材质量
   */
  async evaluateMaterialQuality(material: MaterialRecord): Promise<MaterialQualityScore> {
    // 简化实现：基于文件信息的启发式评分
    // 实际应该使用图像识别 API
    
    let score: MaterialQualityScore = {
      totalScore: 50,
      clarity: 10,
      composition: 10,
      lighting: 10,
      relevance: 10,
      freshness: 10,
    };

    try {
      if (material.source === 'local') {
        // 本地素材：检查文件大小、分辨率等
        const stat = fs.statSync(material.path);
        const sizeKB = stat.size / 1024;
        
        // 清晰度：文件越大通常越清晰（简化逻辑）
        score.clarity = Math.min(20, Math.floor(sizeKB / 500));
        
        // 新鲜度：文件越新越新鲜
        const daysOld = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
        score.freshness = Math.max(0, 20 - Math.floor(daysOld / 30));
        
      } else if (material.source === 'internet') {
        // 网络素材：默认给中等分数
        score.clarity = 15;
        score.composition = 15;
        score.lighting = 15;
        score.relevance = 15;
        score.freshness = 15;
      }
      
      score.totalScore = score.clarity + score.composition + score.lighting + 
                         score.relevance + score.freshness;
      
      material.qualityScore = score;
      logger.debug(`评估素材质量：${material.id}, 总分=${score.totalScore}`);
    } catch (error) {
      logger.warn(`评估素材质量失败：${error instanceof Error ? error.message : String(error)}`);
    }
    
    return score;
  }

  /**
   * 获取素材使用统计
   */
  async getUsageStatistics(): Promise<{
    totalMaterials: number;
    localCount: number;
    internetCount: number;
    totalUsage: number;
    averageUsagePerMaterial: number;
  }> {
    const allRecords = await materialRecordStorage.getAllMaterialRecords();
    const localCount = allRecords.filter(m => m.source === 'local').length;
    const internetCount = allRecords.filter(m => m.source === 'internet').length;
    const totalUsage = allRecords.reduce((sum, m) => sum + m.usage_count, 0);
    
    return {
      totalMaterials: allRecords.length,
      localCount,
      internetCount,
      totalUsage,
      averageUsagePerMaterial: allRecords.length > 0 
        ? totalUsage / allRecords.length 
        : 0,
    };
  }
}

// 导出单例
export const hybridMaterialService = new HybridMaterialService();
