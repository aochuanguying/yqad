import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('content-quality-scoring-storage');

export interface ContentQualityScoringConfig {
  enabled: boolean;
  minScore: number;
  weights: {
    completeness: number;
    originality: number;
    diversity: number;
    attractiveness: number;
  };
}

class ContentQualityScoringStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['content_quality_scoring_config']);
      if (rows.length === 0) {
        logger.warn('content_quality_scoring_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('内容质量评分配置存储初始化完成');
    } catch (error) {
      logger.error('内容质量评分配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS content_quality_scoring_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        min_score INT DEFAULT 60,
        weight_completeness DECIMAL(3,2) DEFAULT 0.30,
        weight_originality DECIMAL(3,2) DEFAULT 0.30,
        weight_diversity DECIMAL(3,2) DEFAULT 0.20,
        weight_attractiveness DECIMAL(3,2) DEFAULT 0.20,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ content_quality_scoring_config 表创建成功');
    await this.query(`
      INSERT INTO content_quality_scoring_config (enabled, min_score, weight_completeness, weight_originality, weight_diversity, weight_attractiveness)
      SELECT 1, 60, 0.30, 0.30, 0.20, 0.20 WHERE NOT EXISTS (SELECT 1 FROM content_quality_scoring_config)
    `);
    logger.info('✅ 默认内容质量评分配置数据插入成功');
  }

  async getConfig(): Promise<ContentQualityScoringConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, min_score, weight_completeness, weight_originality, weight_diversity, weight_attractiveness FROM content_quality_scoring_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        minScore: row.min_score,
        weights: {
          completeness: parseFloat(row.weight_completeness),
          originality: parseFloat(row.weight_originality),
          diversity: parseFloat(row.weight_diversity),
          attractiveness: parseFloat(row.weight_attractiveness),
        },
      };
    } catch (error) {
      logger.error('获取内容质量评分配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: ContentQualityScoringConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM content_quality_scoring_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO content_quality_scoring_config (enabled, min_score, weight_completeness, weight_originality, weight_diversity, weight_attractiveness)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [config.enabled ? 1 : 0, config.minScore, config.weights.completeness, config.weights.originality, config.weights.diversity, config.weights.attractiveness]
        );
        logger.info('内容质量评分配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE content_quality_scoring_config 
           SET enabled = ?, min_score = ?, weight_completeness = ?, weight_originality = ?, weight_diversity = ?, weight_attractiveness = ?
           WHERE id = ?`,
          [config.enabled ? 1 : 0, config.minScore, config.weights.completeness, config.weights.originality, config.weights.diversity, config.weights.attractiveness, rows[0].id]
        );
        logger.info('内容质量评分配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存内容质量评分配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: ContentQualityScoringStorage | null = null;
export function getContentQualityScoringStorage(): ContentQualityScoringStorage {
  if (!instance) instance = new ContentQualityScoringStorage();
  return instance;
}
export const contentQualityScoringStorage = getContentQualityScoringStorage();
