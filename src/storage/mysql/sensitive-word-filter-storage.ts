import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('sensitive-word-filter-storage');

export interface SensitiveWordFilterConfig {
  enabled: boolean;
  wordLibraryPath: string;
  enableReplacement: boolean;
  autoRejectOnForbidden: boolean;
  warningThreshold: number;
}

class SensitiveWordFilterStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['sensitive_word_filter_config']);
      if (rows.length === 0) {
        logger.warn('sensitive_word_filter_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('敏感词过滤配置存储初始化完成');
    } catch (error) {
      logger.error('敏感词过滤配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS sensitive_word_filter_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        word_library_path VARCHAR(500) DEFAULT './data/sensitive-words.json',
        enable_replacement TINYINT(1) DEFAULT 1,
        auto_reject_on_forbidden TINYINT(1) DEFAULT 1,
        warning_threshold INT DEFAULT 3,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ sensitive_word_filter_config 表创建成功');
    await this.query(`
      INSERT INTO sensitive_word_filter_config (enabled, word_library_path, enable_replacement, auto_reject_on_forbidden, warning_threshold)
      SELECT 1, './data/sensitive-words.json', 1, 1, 3 WHERE NOT EXISTS (SELECT 1 FROM sensitive_word_filter_config)
    `);
    logger.info('✅ 默认敏感词过滤配置数据插入成功');
  }

  async getConfig(): Promise<SensitiveWordFilterConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, word_library_path, enable_replacement, auto_reject_on_forbidden, warning_threshold FROM sensitive_word_filter_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        wordLibraryPath: row.word_library_path,
        enableReplacement: row.enable_replacement === 1,
        autoRejectOnForbidden: row.auto_reject_on_forbidden === 1,
        warningThreshold: row.warning_threshold,
      };
    } catch (error) {
      logger.error('获取敏感词过滤配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: SensitiveWordFilterConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM sensitive_word_filter_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO sensitive_word_filter_config (enabled, word_library_path, enable_replacement, auto_reject_on_forbidden, warning_threshold)
           VALUES (?, ?, ?, ?, ?)`,
          [config.enabled ? 1 : 0, config.wordLibraryPath, config.enableReplacement ? 1 : 0, config.autoRejectOnForbidden ? 1 : 0, config.warningThreshold]
        );
        logger.info('敏感词过滤配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE sensitive_word_filter_config 
           SET enabled = ?, word_library_path = ?, enable_replacement = ?, auto_reject_on_forbidden = ?, warning_threshold = ?
           WHERE id = ?`,
          [config.enabled ? 1 : 0, config.wordLibraryPath, config.enableReplacement ? 1 : 0, config.autoRejectOnForbidden ? 1 : 0, config.warningThreshold, rows[0].id]
        );
        logger.info('敏感词过滤配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存敏感词过滤配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: SensitiveWordFilterStorage | null = null;
export function getSensitiveWordFilterStorage(): SensitiveWordFilterStorage {
  if (!instance) instance = new SensitiveWordFilterStorage();
  return instance;
}
export const sensitiveWordFilterStorage = getSensitiveWordFilterStorage();
