/**
 * 敏感词过滤服务
 * 
 * 功能：
 * 1. 基于 Trie 树实现敏感词快速匹配
 * 2. 支持敏感词分级处理（禁止/替换/警告）
 * 3. 支持敏感词自动替换
 * 4. 支持词库热更新
 */

import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { sensitiveWordsStorage } from '../storage/redis/sensitive-words-storage';

const logger = getLogger('sensitive-word-filter');

/**
 * 敏感词级别
 */
export enum SensitiveWordLevel {
  FORBIDDEN = 'forbidden',   // 禁止类，直接拒绝
  REPLACEABLE = 'replaceable', // 可替换类，自动替换
  WARNING = 'warning',       // 警告类，仅记录警告
}

/**
 * 敏感词条目
 */
export interface SensitiveWordEntry {
  word: string;
  level: SensitiveWordLevel;
  replacement?: string;      // 替换词（仅 replaceable 级别）
  reason?: string;           // 敏感原因
}

/**
 * 敏感词检测结果
 */
export interface SensitiveWordDetectionResult {
  containsForbidden: boolean;
  containsReplaceable: boolean;
  containsWarning: boolean;
  totalFound: number;
  foundWords: Array<{
    word: string;
    level: SensitiveWordLevel;
    position: number;
    replacement?: string;
    reason?: string;
  }>;
  shouldReject: boolean;
  rejectReason?: string;
}

/**
 * 敏感词替换结果
 */
export interface SensitiveWordReplacementResult {
  originalText: string;
  filteredText: string;
  replacedCount: number;
  replacedWords: Array<{
    word: string;
    replacement: string;
    position: number;
  }>;
}

/**
 * Trie 树节点
 */
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
  wordData?: {
    level: SensitiveWordLevel;
    replacement?: string;
    reason?: string;
  };
}

/**
 * 敏感词库配置
 */
export interface SensitiveWordLibrary {
  version: string;
  updatedAt: string;
  categories: {
    forbidden?: {
      name: string;
      description: string;
      words: string[];
    };
    replaceable?: {
      name: string;
      description: string;
      words: Array<{
        word: string;
        replacement: string;
        reason: string;
      }>;
    };
    warning?: {
      name: string;
      description: string;
      words: string[];
    };
  };
  settings: {
    caseSensitive: boolean;
    wholeWordMatch: boolean;
    enableReplacement: boolean;
    autoRejectOnForbidden: boolean;
    warningThreshold: number;
  };
}

/**
 * 敏感词过滤服务类
 */
class SensitiveWordFilterService {
  private root = new TrieNode();
  private wordLibrary: SensitiveWordLibrary | null = null;
  private lastLoadTime = 0;
  private loadInterval = 5 * 60 * 1000; // 5 分钟重新加载一次

  /**
   * 初始化 Trie 树（从 Redis 加载）
   */
  private async initTrieFromRedis(): Promise<void> {
    try {
      // 从 Redis 获取所有敏感词
      const allWords = await sensitiveWordsStorage.getAllWords();
      
      if (allWords.length === 0) {
        logger.warn('Redis 敏感词库为空');
        this.wordLibrary = null;
        return;
      }

      // 构建简单的词库结构
      this.wordLibrary = {
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
        categories: {
          forbidden: {
            name: '禁止类',
            description: '禁止使用的敏感词',
            words: [],
          },
          replaceable: {
            name: '可替换类',
            description: '可自动替换的敏感词',
            words: allWords.map(word => ({
              word,
              replacement: '*',
              reason: '敏感词',
            })),
          },
          warning: {
            name: '警告类',
            description: '需要警告的敏感词',
            words: [],
          },
        },
        settings: {
          caseSensitive: false,
          wholeWordMatch: false,
          enableReplacement: true,
          autoRejectOnForbidden: true,
          warningThreshold: 3,
        },
      };

      this.buildTrie();
      this.lastLoadTime = Date.now();
      logger.info(`敏感词库从 Redis 加载成功，共 ${allWords.length} 个词`);
    } catch (error) {
      logger.error(`从 Redis 加载敏感词库失败：${error instanceof Error ? error.message : String(error)}`);
      this.wordLibrary = null;
    }
  }

  /**
   * 从词库构建 Trie 树
   */
  private buildTrie(): void {
    if (!this.wordLibrary) {
      return;
    }

    this.root = new TrieNode();

    // 添加禁止类词汇
    if (this.wordLibrary.categories.forbidden?.words) {
      for (const word of this.wordLibrary.categories.forbidden.words) {
        this.insertWord(word, {
          level: SensitiveWordLevel.FORBIDDEN,
          reason: this.wordLibrary.categories.forbidden?.description,
        });
      }
    }

    // 添加可替换类词汇
    if (this.wordLibrary.categories.replaceable?.words) {
      for (const item of this.wordLibrary.categories.replaceable.words) {
        this.insertWord(item.word, {
          level: SensitiveWordLevel.REPLACEABLE,
          replacement: item.replacement,
          reason: item.reason,
        });
      }
    }

    // 添加警告类词汇
    if (this.wordLibrary.categories.warning?.words) {
      for (const word of this.wordLibrary.categories.warning.words) {
        this.insertWord(word, {
          level: SensitiveWordLevel.WARNING,
          reason: this.wordLibrary.categories.warning?.description,
        });
      }
    }

    const totalWords = 
      (this.wordLibrary.categories.forbidden?.words.length || 0) +
      (this.wordLibrary.categories.replaceable?.words.length || 0) +
      (this.wordLibrary.categories.warning?.words.length || 0);

    logger.info(`敏感词 Trie 树构建完成，共 ${totalWords} 个词汇`);
  }

  /**
   * 向 Trie 树插入一个词
   */
  private insertWord(word: string, data: { level: SensitiveWordLevel; replacement?: string; reason?: string }): void {
    const config = this.wordLibrary?.settings;
    const text = config?.caseSensitive ? word : word.toLowerCase();
    
    let node = this.root;
    for (const char of text) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char)!;
    }
    
    node.isEndOfWord = true;
    node.wordData = data;
  }

  /**
   * 确保词库已加载（异步，从 Redis）
   */
  private async ensureLibraryLoadedAsync(): Promise<void> {
    const now = Date.now();
    
    // 首次加载或超过重新加载间隔
    if (!this.wordLibrary || now - this.lastLoadTime > this.loadInterval) {
      await this.initTrieFromRedis();
    }
  }



  /**
   * 检测文本中的敏感词
   * @param text 待检测文本
   * @returns 检测结果
   */
  async detectSensitiveWords(text: string): Promise<SensitiveWordDetectionResult> {
    await this.ensureLibraryLoadedAsync();

    const result: SensitiveWordDetectionResult = {
      containsForbidden: false,
      containsReplaceable: false,
      containsWarning: false,
      totalFound: 0,
      foundWords: [],
      shouldReject: false,
    };

    if (!this.wordLibrary) {
      logger.debug('敏感词库未加载，跳过检测');
      return result;
    }

    const config = this.wordLibrary.settings;
    const checkText = config.caseSensitive ? text : text.toLowerCase();

    // 滑动窗口检测所有可能的敏感词
    for (let i = 0; i < checkText.length; i++) {
      let node = this.root;
      let lastMatchEnd = -1;
      let lastMatchData: typeof node.wordData = undefined;

      // 从位置 i 开始，尝试匹配尽可能长的词
      for (let j = i; j < checkText.length; j++) {
        const char = checkText[j];
        
        if (!node.children.has(char)) {
          break;
        }

        node = node.children.get(char)!;
        
        if (node.isEndOfWord) {
          lastMatchEnd = j;
          lastMatchData = node.wordData;
        }
      }

      // 如果找到匹配的词
      if (lastMatchEnd !== -1 && lastMatchData) {
        const matchedWord = checkText.substring(i, lastMatchEnd + 1);
        const originalWord = text.substring(i, lastMatchEnd + 1);

        result.foundWords.push({
          word: originalWord,
          level: lastMatchData.level,
          position: i,
          replacement: lastMatchData.replacement,
          reason: lastMatchData.reason,
        });

        result.totalFound++;

        if (lastMatchData.level === SensitiveWordLevel.FORBIDDEN) {
          result.containsForbidden = true;
          if (config.autoRejectOnForbidden) {
            result.shouldReject = true;
            result.rejectReason = `包含禁止类词汇："${originalWord}"`;
            return result; // 立即返回
          }
        } else if (lastMatchData.level === SensitiveWordLevel.REPLACEABLE) {
          result.containsReplaceable = true;
        } else if (lastMatchData.level === SensitiveWordLevel.WARNING) {
          result.containsWarning = true;
        }

        // 跳过已匹配的字符
        i = lastMatchEnd;
      }
    }

    // 检查警告阈值
    if (result.containsWarning && result.foundWords.filter(w => w.level === SensitiveWordLevel.WARNING).length >= config.warningThreshold) {
      result.shouldReject = true;
      result.rejectReason = `警告类词汇超过阈值 (${config.warningThreshold})`;
    }

    return result;
  }

  /**
   * 替换敏感词
   * @param text 原始文本
   * @returns 替换结果
   */
  async replaceSensitiveWords(text: string): Promise<SensitiveWordReplacementResult> {
    await this.ensureLibraryLoadedAsync();

    const result: SensitiveWordReplacementResult = {
      originalText: text,
      filteredText: text,
      replacedCount: 0,
      replacedWords: [],
    };

    if (!this.wordLibrary || !this.wordLibrary.settings.enableReplacement) {
      return result;
    }

    const config = this.wordLibrary.settings;
    const checkText = config.caseSensitive ? text : text.toLowerCase();
    
    // 收集所有需要替换的词
    const replacements: Array<{
      start: number;
      end: number;
      word: string;
      replacement: string;
    }> = [];

    for (let i = 0; i < checkText.length; i++) {
      let node = this.root;
      let lastMatchEnd = -1;
      let lastMatchData: typeof node.wordData = undefined;

      for (let j = i; j < checkText.length; j++) {
        const char = checkText[j];
        
        if (!node.children.has(char)) {
          break;
        }

        node = node.children.get(char)!;
        
        if (node.isEndOfWord && node.wordData?.level === SensitiveWordLevel.REPLACEABLE) {
          lastMatchEnd = j;
          lastMatchData = node.wordData;
        }
      }

      if (lastMatchEnd !== -1 && lastMatchData?.replacement) {
        const matchedWord = text.substring(i, lastMatchEnd + 1);
        
        replacements.push({
          start: i,
          end: lastMatchEnd + 1,
          word: matchedWord,
          replacement: lastMatchData.replacement,
        });

        i = lastMatchEnd;
      }
    }

    // 从后向前替换，避免索引偏移
    for (let i = replacements.length - 1; i >= 0; i--) {
      const { start, end, word, replacement } = replacements[i];
      result.filteredText = 
        result.filteredText.substring(0, start) + 
        replacement + 
        result.filteredText.substring(end);
      
      result.replacedWords.push({
        word,
        replacement,
        position: start,
      });
      result.replacedCount++;
    }

    if (result.replacedCount > 0) {
      logger.info(`敏感词替换：替换 ${result.replacedCount} 个词汇`);
    }

    return result;
  }

  /**
   * 检测并替换敏感词（一体化操作）
   * @param text 原始文本
   * @returns 检测结果和替换后的文本
   */
  async detectAndReplace(text: string): Promise<{
    detection: SensitiveWordDetectionResult;
    filteredText: string;
    shouldReject: boolean;
  }> {
    const detection = await this.detectSensitiveWords(text);
    
    if (detection.shouldReject) {
      return {
        detection,
        filteredText: text,
        shouldReject: true,
      };
    }

    const replacement = await this.replaceSensitiveWords(text);

    return {
      detection,
      filteredText: replacement.filteredText,
      shouldReject: false,
    };
  }

  /**
   * 获取敏感词库信息
   */
  async getLibraryInfo(): Promise<SensitiveWordLibrary | null> {
    await this.ensureLibraryLoadedAsync();
    return this.wordLibrary;
  }

  /**
   * 重新加载敏感词库（从 Redis）
   */
  async reloadLibraryFromRedis(): Promise<boolean> {
    try {
      await this.initTrieFromRedis();
      // 发布更新通知
      await sensitiveWordsStorage.reloadWordLibrary();
      return true;
    } catch (error) {
      logger.error(`从 Redis 重新加载敏感词库失败：${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 重新加载敏感词库（从 Redis）
   */
  async reloadLibrary(): Promise<boolean> {
    try {
      await this.initTrieFromRedis();
      return true;
    } catch (error) {
      logger.error(`重新加载敏感词库失败：${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 添加敏感词（同步到 Redis）
   */
  async addWord(word: string, level: SensitiveWordLevel, replacement?: string, reason?: string): Promise<void> {
    // 添加到 Trie 树
    this.insertWord(word, { level, replacement, reason });
    
    // 同步到 Redis
    await sensitiveWordsStorage.addWord(word);
    
    logger.info(`添加敏感词："${word}" (级别：${level})`);
  }

  /**
   * 移除敏感词（同步到 Redis）
   */
  async removeWord(word: string): Promise<void> {
    // 从 Trie 树移除（需要重新构建树，这里简化处理）
    logger.warn('移除敏感词功能需要重新构建 Trie 树，建议重启服务');
    
    // 从 Redis 移除
    await sensitiveWordsStorage.removeWord(word);
    
    logger.info(`移除敏感词："${word}"`);
  }

  /**
   * 批量导入敏感词（从 Redis）
   */
  async importWordsFromRedis(): Promise<number> {
    const allWords = await sensitiveWordsStorage.getAllWords();
    
    // 重新构建 Trie 树
    this.wordLibrary = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      categories: {
        replaceable: {
          name: '可替换类',
          description: '可自动替换的敏感词',
          words: allWords.map(word => ({
            word,
            replacement: '*',
            reason: '敏感词',
          })),
        },
      },
      settings: {
        caseSensitive: false,
        wholeWordMatch: false,
        enableReplacement: true,
        autoRejectOnForbidden: true,
        warningThreshold: 3,
      },
    };
    
    this.buildTrie();
    logger.info(`从 Redis 导入 ${allWords.length} 个敏感词`);
    
    return allWords.length;
  }

  /**
   * 清除 Trie 树（用于测试）
   */
  clear(): void {
    this.root = new TrieNode();
    this.wordLibrary = null;
    this.lastLoadTime = 0;
  }
}

// 导出单例
export const sensitiveWordFilterService = new SensitiveWordFilterService();
