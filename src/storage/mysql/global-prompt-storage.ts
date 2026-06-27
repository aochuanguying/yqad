/**
 * 全局人设 MySQL 存储层
 */

import { MySQLConnectionManager } from '../../utils/mysql-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('global-prompt-storage');

/**
 * 全局人设数据库记录
 */
export interface MySQLGlobalPrompt {
  id: number;
  personal_info: string;  // JSON 字符串
  style_description: string | null;
  updated_at: Date;
  created_at: Date;
}

/**
 * 保存全局人设输入
 */
export interface CreateGlobalPromptInput {
  personalInfo: {
    carModel: string;
    gender: string;
    ageGroup: string;
  };
  styleDescription: string | null;
}

class GlobalPromptStorage {
  /**
   * 保存全局人设（单例模式，只保留一条记录）
   */
  async save(input: CreateGlobalPromptInput): Promise<void> {
    const sql = `
      INSERT INTO global_prompts (personal_info, style_description)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE
        personal_info = VALUES(personal_info),
        style_description = VALUES(style_description),
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [input.personalInfo, input.styleDescription];

    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      // 检查是否已有记录
      const [existing] = await connection.execute('SELECT id FROM global_prompts LIMIT 1');
      
      if (Array.isArray(existing) && existing.length > 0) {
        // 更新现有记录
        await connection.execute(
          'UPDATE global_prompts SET personal_info = ?, style_description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [input.personalInfo, input.styleDescription, (existing as any)[0].id]
        );
        logger.debug('更新全局人设配置');
      } else {
        // 插入新记录
        await connection.execute(sql, params);
        logger.debug('创建全局人设配置');
      }
    } finally {
      await connection.release();
    }
  }

  /**
   * 获取全局人设
   */
  async get(): Promise<MySQLGlobalPrompt | null> {
    const sql = 'SELECT * FROM global_prompts ORDER BY updated_at DESC LIMIT 1';
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows] = await connection.execute(sql);
      const result = Array.isArray(rows) ? (rows as any[])[0] : rows;
      return result || null;
    } finally {
      await connection.release();
    }
  }
}

export const globalPromptStorage = new GlobalPromptStorage();
