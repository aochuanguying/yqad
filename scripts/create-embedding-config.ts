/**
 * 创建 embedding_config 表并从 ai_providers 复制配置
 */

import * as mysql from 'mysql2/promise';
import { loadConfig } from '../src/utils/config';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('create-embedding-config');

async function createEmbeddingConfig(): Promise<void> {
  const config = loadConfig();
  const mysqlConfig = config.mysql.production;

  logger.info('开始创建 embedding_config 表...');

  const connection = await mysql.createConnection({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    database: mysqlConfig.database,
  });

  try {
    // 1. 创建表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`embedding_config\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT,
        \`api_key\` VARCHAR(500) NOT NULL COMMENT 'API Key',
        \`base_url\` VARCHAR(500) DEFAULT 'https://api.openai.com/v1' COMMENT 'API Base URL',
        \`model\` VARCHAR(100) DEFAULT 'text-embedding-3-small' COMMENT 'Embedding 模型',
        \`dimension\` INT DEFAULT 1536 COMMENT '向量维度',
        \`enabled\` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Embedding 向量配置表'
    `);

    logger.info('✓ embedding_config 表创建成功');

    // 2. 从 ai_providers 复制配置
    const [providers] = await connection.query<any[]>(
      'SELECT api_key, base_url FROM ai_providers WHERE name = "deepseek" AND api_key IS NOT NULL LIMIT 1'
    );

    if (providers.length > 0) {
      const provider = providers[0];
      
      await connection.execute(
        `INSERT INTO embedding_config (api_key, base_url, model, dimension, enabled)
         VALUES (?, ?, 'text-embedding-3-small', 1536, 1)
         ON DUPLICATE KEY UPDATE
           api_key = VALUES(api_key),
           base_url = VALUES(base_url)`,
        [provider.api_key, provider.base_url || 'https://api.openai.com/v1']
      );

      logger.info('✓ 已从 deepseek provider 复制配置到 embedding_config');
      logger.info(`  API Key: ${provider.api_key.substring(0, 10)}...`);
      logger.info(`  Base URL: ${provider.base_url || 'https://api.openai.com/v1'}`);
    } else {
      logger.warn('⚠️  未找到 deepseek provider 配置，请手动配置 embedding_config 表');
    }

    // 3. 验证配置
    const [rows] = await connection.query<any[]>('SELECT * FROM embedding_config LIMIT 1');
    if (rows.length > 0) {
      logger.info('✓ embedding_config 配置验证成功');
      logger.info(`  Model: text-embedding-3-small`);
      logger.info(`  Dimension: 1536`);
    }

    logger.info('✅ embedding_config 配置完成');
  } catch (error) {
    logger.error('创建 embedding_config 失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// 执行
createEmbeddingConfig()
  .then(() => {
    logger.info('脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('脚本执行失败:', error);
    process.exit(1);
  });
