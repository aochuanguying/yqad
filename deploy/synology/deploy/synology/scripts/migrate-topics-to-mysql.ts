/**
 * 迁移 topics.json 到 MySQL 数据库
 */

import * as fs from 'fs';
import * as path from 'path';
import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('migrate-topics');

interface Topic {
  id: string;
  name: string;
  subDirections?: Array<{
    id: string;
    name: string;
  }>;
  maxUseCount?: number;
  currentUseCount?: number;
  status?: 'available' | 'unavailable';
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

async function migrateTopicsToMySQL(): Promise<void> {
  logger.info('开始迁移 topics.json 到 MySQL...');

  const topicsPath = path.resolve(process.cwd(), 'data/topics.json');
  
  if (!fs.existsSync(topicsPath)) {
    logger.warn('topics.json 不存在，跳过迁移');
    return;
  }

  try {
    // 读取 topics.json
    const data = fs.readFileSync(topicsPath, 'utf-8');
    const topics: Topic[] = JSON.parse(data);
    
    logger.info(`读取到 ${topics.length} 个主题`);

    // 获取数据库连接
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    
    try {
      // 开启事务
      await connection.beginTransaction();

      // 1. 创建 topics 表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS topics (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) NOT NULL COMMENT '主题名称',
          max_use_count INT DEFAULT 1 COMMENT '最大使用次数',
          current_use_count INT DEFAULT 0 COMMENT '当前使用次数',
          status ENUM('available', 'unavailable') DEFAULT 'available' COMMENT '状态',
          tags JSON COMMENT '标签数组',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_status (status),
          INDEX idx_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='主题表'
      `);

      // 2. 创建 topic_sub_directions 表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS topic_sub_directions (
          id VARCHAR(50) PRIMARY KEY,
          topic_id VARCHAR(50) NOT NULL COMMENT '主题 ID',
          name VARCHAR(255) NOT NULL COMMENT '子方向名称',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
          INDEX idx_topic_id (topic_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='主题子方向表'
      `);

      // 3. 插入主题数据
      for (const topic of topics) {
        // 插入主表
        await connection.execute(
          `INSERT INTO topics (id, name, max_use_count, current_use_count, status, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             max_use_count = VALUES(max_use_count),
             current_use_count = VALUES(current_use_count),
             status = VALUES(status),
             tags = VALUES(tags),
             updated_at = CURRENT_TIMESTAMP`,
          [
            topic.id,
            topic.name,
            topic.maxUseCount || 1,
            topic.currentUseCount || 0,
            topic.status || 'available',
            topic.tags ? JSON.stringify(topic.tags) : null,
            topic.createdAt || new Date().toISOString(),
            topic.updatedAt || new Date().toISOString(),
          ]
        );

        // 插入子方向
        if (topic.subDirections && topic.subDirections.length > 0) {
          for (const sub of topic.subDirections) {
            await connection.execute(
              `INSERT INTO topic_sub_directions (id, topic_id, name)
               VALUES (?, ?, ?)
               ON DUPLICATE KEY UPDATE name = VALUES(name)`,
              [sub.id, topic.id, sub.name]
            );
          }
        }
      }

      // 提交事务
      await connection.commit();
      
      logger.info(`✅ 成功迁移 ${topics.length} 个主题到 MySQL`);
      
    } catch (error) {
      // 回滚事务
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }

  } catch (error: any) {
    logger.error(`迁移失败：${error.message}`);
    throw error;
  }
}

// 执行迁移
if (require.main === module) {
  migrateTopicsToMySQL()
    .then(() => {
      logger.info('迁移完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error(error);
      process.exit(1);
    });
}

export { migrateTopicsToMySQL };
