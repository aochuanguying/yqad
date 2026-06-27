import { BaseDAO } from './dao/base-dao';
import { getLogger } from '../../utils/logger';

const logger = getLogger('compliance-report-config-storage');

export interface ComplianceCheckReportConfig {
  enabled: boolean;
  storagePath: string;
  retainDays: number;
  timeout: number;
  postScript: string;
}

class ComplianceReportConfigStorage extends BaseDAO {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const rows = await this.query<any[]>("SHOW TABLES LIKE ?", ['compliance_check_report_config']);
      if (rows.length === 0) {
        logger.warn('compliance_check_report_config 表不存在，将自动创建');
        await this.createTable();
      }
      this.initialized = true;
      logger.info('合规性检查报告配置存储初始化完成');
    } catch (error) {
      logger.error('合规性检查报告配置存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async createTable(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS compliance_check_report_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT(1) DEFAULT 1,
        storage_path VARCHAR(500) DEFAULT './data/compliance-reports',
        retain_days INT DEFAULT 30,
        timeout INT DEFAULT 5000,
        post_script VARCHAR(100) DEFAULT 'audi_post.js',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    logger.info('✅ compliance_check_report_config 表创建成功');
    await this.query(`
      INSERT INTO compliance_check_report_config (enabled, storage_path, retain_days, timeout, post_script)
      SELECT 1, './data/compliance-reports', 30, 5000, 'audi_post.js' WHERE NOT EXISTS (SELECT 1 FROM compliance_check_report_config)
    `);
    logger.info('✅ 默认合规性检查报告配置数据插入成功');
  }

  async getConfig(): Promise<ComplianceCheckReportConfig | null> {
    try {
      const rows = await this.query<any[]>(
        'SELECT enabled, storage_path, retain_days, timeout, post_script FROM compliance_check_report_config LIMIT 1'
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        enabled: row.enabled === 1,
        storagePath: row.storage_path,
        retainDays: row.retain_days,
        timeout: row.timeout,
        postScript: row.post_script,
      };
    } catch (error) {
      logger.error('获取合规性检查报告配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async saveConfig(config: ComplianceCheckReportConfig): Promise<void> {
    try {
      const rows = await this.query<any[]>('SELECT id FROM compliance_check_report_config LIMIT 1');
      if (rows.length === 0) {
        await this.query(
          `INSERT INTO compliance_check_report_config (enabled, storage_path, retain_days, timeout, post_script)
           VALUES (?, ?, ?, ?, ?)`,
          [config.enabled ? 1 : 0, config.storagePath, config.retainDays, config.timeout, config.postScript]
        );
        logger.info('合规性检查报告配置已保存（新增）');
      } else {
        await this.query(
          `UPDATE compliance_check_report_config 
           SET enabled = ?, storage_path = ?, retain_days = ?, timeout = ?, post_script = ?
           WHERE id = ?`,
          [config.enabled ? 1 : 0, config.storagePath, config.retainDays, config.timeout, config.postScript, rows[0].id]
        );
        logger.info('合规性检查报告配置已保存（更新）');
      }
    } catch (error) {
      logger.error('保存合规性检查报告配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

let instance: ComplianceReportConfigStorage | null = null;
export function getComplianceReportConfigStorage(): ComplianceReportConfigStorage {
  if (!instance) instance = new ComplianceReportConfigStorage();
  return instance;
}
export const complianceReportConfigStorage = getComplianceReportConfigStorage();
