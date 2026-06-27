/**
 * AI 提供商 MySQL 存储层
 */

import { MySQLConnectionManager } from '../../utils/mysql-connection-manager';
import { getLogger } from '../../utils/logger';

const logger = getLogger('ai-provider-storage');

/**
 * AI 提供商数据库记录
 */
export interface AIProviderRecord {
  id: number;
  name: string;
  model: string;
  base_url: string;
  api_key: string;
  temperature: number;
  max_tokens: number;
  request_timeout: number;
  enabled: boolean;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * AI 提供商配置
 */
export interface AIProviderConfig {
  name: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  requestTimeout?: number;
}

/**
 * AI 提供商查询选项
 */
export interface AIProviderQueryOptions {
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

export class AIProviderStorage {
  private static instance: AIProviderStorage;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): AIProviderStorage {
    if (!AIProviderStorage.instance) {
      AIProviderStorage.instance = new AIProviderStorage();
    }
    return AIProviderStorage.instance;
  }

  /**
   * 初始化数据库表
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const connection = await MySQLConnectionManager.getInstance().getConnection();
      try {
        // 检查表是否存在
        const [rows]: any[] = await connection.execute(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ai_providers'"
        );

        if (rows.length === 0) {
          logger.warn('ai_providers 表不存在，将自动创建');
          // 自动创建表
          await this.createTable(connection);
        }

        this.initialized = true;
        logger.info('AI Provider 存储初始化完成');
      } finally {
        await connection.release();
      }
    } catch (error) {
      logger.error('AI Provider 存储初始化失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * 创建数据库表
   */
  private async createTable(connection: any): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ai_providers (
        id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增 ID',
        name VARCHAR(100) NOT NULL UNIQUE COMMENT '提供商名称',
        model VARCHAR(100) NOT NULL COMMENT '模型名称',
        base_url VARCHAR(500) NOT NULL COMMENT 'API Base URL',
        api_key VARCHAR(500) NOT NULL COMMENT 'API Key',
        temperature DECIMAL(3,2) DEFAULT 0.70 COMMENT '温度参数 (0.00-2.00)',
        max_tokens INT DEFAULT 4000 COMMENT '最大 Token 数',
        request_timeout INT DEFAULT 30000 COMMENT '请求超时 (毫秒)',
        enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        priority INT DEFAULT 0 COMMENT '优先级（数字越小优先级越高）',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_priority (priority),
        INDEX idx_enabled (enabled),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI 提供商配置表'
    `;

    await connection.execute(createTableSQL);
    logger.info('✅ ai_providers 表创建成功');

    // 插入默认数据
    const insertSQL = `
      INSERT INTO ai_providers (name, model, base_url, api_key, temperature, max_tokens, request_timeout, enabled, priority) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE 
        model = VALUES(model),
        base_url = VALUES(base_url),
        api_key = VALUES(api_key),
        temperature = VALUES(temperature),
        max_tokens = VALUES(max_tokens),
        request_timeout = VALUES(request_timeout),
        priority = VALUES(priority)
    `;

    // 插入默认的两个 provider
    const defaultProviders = [
      ['gpt', 'gpt-5.5', 'http://47.104.95.133:16781/v1', 'sk-chenyao-JBr74LyRGDbxaih1OqtHJcFP2Og3n8BeroW82Y2P', 0.7, 1000, 30000, 0],
      ['higpt', 'higpt', 'https://higpt.hxfssc.com:8088/v1', 'LqgltIIdlFVQFdi5EMa98HtRVXzq6KGA', 0.7, 6000, 60000, 1],
    ];

    for (const provider of defaultProviders) {
      await connection.execute(insertSQL, provider);
    }

    logger.info('✅ 默认 AI 提供商数据插入成功');
  }

  /**
   * 获取所有启用的 AI 提供商（按优先级排序）
   */
  async getEnabledProviders(): Promise<AIProviderConfig[]> {
    const sql = `
      SELECT name, model, base_url, api_key, temperature, max_tokens, request_timeout
      FROM ai_providers
      WHERE enabled = 1
      ORDER BY priority ASC, id ASC
    `;

    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows]: any[] = await connection.execute(sql);
      
      return (rows as any[]).map(row => ({
        name: row.name,
        model: row.model,
        baseUrl: row.base_url,
        apiKey: row.api_key,
        temperature: row.temperature,
        maxTokens: row.max_tokens,
        requestTimeout: row.request_timeout,
      }));
    } finally {
      await connection.release();
    }
  }

  /**
   * 获取所有 AI 提供商（包括禁用的）
   */
  async getAllProviders(): Promise<AIProviderConfig[]> {
    const sql = `
      SELECT name, model, base_url, api_key, temperature, max_tokens, request_timeout, enabled, priority
      FROM ai_providers
      ORDER BY priority ASC, id ASC
    `;

    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows]: any[] = await connection.execute(sql);
      
      return (rows as any[]).map(row => ({
        name: row.name,
        model: row.model,
        baseUrl: row.base_url,
        apiKey: row.api_key,
        temperature: row.temperature,
        maxTokens: row.max_tokens,
        requestTimeout: row.request_timeout,
      }));
    } finally {
      await connection.release();
    }
  }

  /**
   * 根据名称获取 AI 提供商
   */
  async getProviderByName(name: string): Promise<AIProviderConfig | null> {
    const sql = `
      SELECT name, model, base_url, api_key, temperature, max_tokens, request_timeout
      FROM ai_providers
      WHERE name = ?
    `;

    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      const [rows]: any[] = await connection.execute(sql, [name]);
      
      if (rows.length === 0) {
        return null;
      }

      const row = (rows as any[])[0];
      return {
        name: row.name,
        model: row.model,
        baseUrl: row.base_url,
        apiKey: row.api_key,
        temperature: row.temperature,
        maxTokens: row.max_tokens,
        requestTimeout: row.request_timeout,
      };
    } finally {
      await connection.release();
    }
  }

  /**
   * 保存 AI 提供商配置（更新或插入）
   */
  async saveProvider(provider: AIProviderConfig & { enabled?: boolean; priority?: number }): Promise<void> {
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      // 检查是否存在
      const checkSql = 'SELECT id FROM ai_providers WHERE name = ?';
      const [rows]: any[] = await connection.execute(checkSql, [provider.name]);

      if (rows.length > 0) {
        // 更新现有记录
        const updateSql = `
          UPDATE ai_providers
          SET model = ?, base_url = ?, api_key = ?, temperature = ?, max_tokens = ?, request_timeout = ?
          WHERE name = ?
        `;
        await connection.execute(updateSql, [
          provider.model,
          provider.baseUrl,
          provider.apiKey,
          provider.temperature ?? 0.7,
          provider.maxTokens ?? 4000,
          provider.requestTimeout ?? 30000,
          provider.name,
        ]);
        logger.info(`更新 AI 提供商配置：${provider.name}`);
      } else {
        // 插入新记录
        const insertSql = `
          INSERT INTO ai_providers (name, model, base_url, api_key, temperature, max_tokens, request_timeout, enabled, priority)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.execute(insertSql, [
          provider.name,
          provider.model,
          provider.baseUrl,
          provider.apiKey,
          provider.temperature ?? 0.7,
          provider.maxTokens ?? 4000,
          provider.requestTimeout ?? 30000,
          provider.enabled ?? 1,
          provider.priority ?? 0,
        ]);
        logger.info(`插入 AI 提供商配置：${provider.name}`);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      logger.error('保存 AI 提供商配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      await connection.release();
    }
  }

  /**
   * 批量保存 AI 提供商配置
   */
  async saveProviders(providers: Array<AIProviderConfig & { priority?: number }>): Promise<void> {
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      await connection.beginTransaction();

      // 先删除所有现有记录
      const deleteSql = 'DELETE FROM ai_providers';
      await connection.execute(deleteSql);

      // 批量插入
      const insertSql = `
        INSERT INTO ai_providers (name, model, base_url, api_key, temperature, max_tokens, request_timeout, enabled, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `;

      for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        await connection.execute(insertSql, [
          provider.name,
          provider.model,
          provider.baseUrl,
          provider.apiKey,
          provider.temperature ?? 0.7,
          provider.maxTokens ?? 4000,
          provider.requestTimeout ?? 30000,
          provider.priority ?? i,
        ]);
      }

      await connection.commit();
      logger.info(`批量保存 ${providers.length} 个 AI 提供商配置`);
    } catch (error) {
      await connection.rollback();
      logger.error('批量保存 AI 提供商配置失败:', error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      await connection.release();
    }
  }

  /**
   * 删除 AI 提供商
   */
  async deleteProvider(name: string): Promise<void> {
    const sql = 'DELETE FROM ai_providers WHERE name = ?';
    
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      await connection.execute(sql, [name]);
      logger.info(`删除 AI 提供商配置：${name}`);
    } finally {
      await connection.release();
    }
  }

  /**
   * 清空所有 AI 提供商配置
   */
  async clearAllProviders(): Promise<void> {
    const sql = 'DELETE FROM ai_providers';
    
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    try {
      await connection.execute(sql);
      logger.info('清空所有 AI 提供商配置');
    } finally {
      await connection.release();
    }
  }
}

// 导出单例
export const aiProviderStorage = AIProviderStorage.getInstance();
