/**
 * 迁移 material-records.json 到 MySQL 数据库
 */

import * as fs from 'fs';
import * as path from 'path';
import { MySQLConnectionManager } from '../src/utils/mysql-connection-manager';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('migrate-material-records');

interface MaterialRecord {
  id: string;
  originalPath: string;
  processedPath: string;
  originalHash?: string;
  processedHash?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  isWatermark?: boolean;
  ocrText?: string;
  description?: string;
  tags?: string[];
  sourceType?: 'local' | 'internet';
  internetUrl?: string;
  usedCount?: number;
  lastUsedAt?: string;
  status?: 'available' | 'used' | 'archived';
  createdAt: string;
  updatedAt: string;
}

async function migrateMaterialRecordsToMySQL(): Promise<void> {
  logger.info('开始迁移 material-records.json 到 MySQL...');

  const recordsPath = path.resolve(process.cwd(), 'data/material-records.json');
  
  if (!fs.existsSync(recordsPath)) {
    logger.warn('material-records.json 不存在，跳过迁移');
    return;
  }

  try {
    // 读取 material-records.json
    const data = fs.readFileSync(recordsPath, 'utf-8');
    const records: MaterialRecord[] = JSON.parse(data);
    
    logger.info(`读取到 ${records.length} 条素材记录`);

    // 获取数据库连接
    const connection = await MySQLConnectionManager.getInstance().getConnection();
    
    try {
      // 开启事务
      await connection.beginTransaction();

      // 创建 material_records 表
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS material_records (
          id VARCHAR(100) PRIMARY KEY COMMENT '文件路径哈希或 UUID',
          original_path VARCHAR(500) NOT NULL COMMENT '原始文件路径',
          processed_path VARCHAR(500) NOT NULL COMMENT '处理后文件路径',
          original_hash VARCHAR(64) COMMENT '原始文件哈希',
          processed_hash VARCHAR(64) COMMENT '处理后文件哈希',
          file_size INT COMMENT '文件大小 (字节)',
          width INT COMMENT '图片宽度',
          height INT COMMENT '图片高度',
          format VARCHAR(20) COMMENT '图片格式',
          is_watermark BOOLEAN DEFAULT FALSE COMMENT '是否有水印',
          ocr_text TEXT COMMENT 'OCR 识别文本',
          description TEXT COMMENT '图片描述',
          tags JSON COMMENT '标签数组',
          source_type ENUM('local', 'internet') DEFAULT 'local' COMMENT '来源类型',
          internet_url VARCHAR(500) COMMENT '网络图片 URL',
          used_count INT DEFAULT 0 COMMENT '使用次数',
          last_used_at TIMESTAMP NULL COMMENT '最后使用时间',
          status ENUM('available', 'used', 'archived') DEFAULT 'available' COMMENT '状态',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_status (status),
          INDEX idx_source_type (source_type),
          INDEX idx_used_count (used_count),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='素材记录表'
      `);

      // 插入素材记录
      for (const record of records) {
        await connection.execute(
          `INSERT INTO material_records (
             id, original_path, processed_path, original_hash, processed_hash,
             file_size, width, height, format, is_watermark, ocr_text, description,
             tags, source_type, internet_url, used_count, last_used_at, status,
             created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             original_path = VALUES(original_path),
             processed_path = VALUES(processed_path),
             used_count = VALUES(used_count),
             last_used_at = VALUES(last_used_at),
             status = VALUES(status),
             updated_at = CURRENT_TIMESTAMP`,
          [
            record.id,
            record.originalPath,
            record.processedPath,
            record.originalHash || null,
            record.processedHash || null,
            record.fileSize || null,
            record.width || null,
            record.height || null,
            record.format || null,
            record.isWatermark || false,
            record.ocrText || null,
            record.description || null,
            record.tags ? JSON.stringify(record.tags) : null,
            record.sourceType || 'local',
            record.internetUrl || null,
            record.usedCount || 0,
            record.lastUsedAt || null,
            record.status || 'available',
            record.createdAt,
            record.updatedAt,
          ]
        );
      }

      // 提交事务
      await connection.commit();
      
      logger.info(`✅ 成功迁移 ${records.length} 条素材记录到 MySQL`);
      
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
  migrateMaterialRecordsToMySQL()
    .then(() => {
      logger.info('迁移完成');
      process.exit(0);
    })
    .catch((error) => {
      logger.error(error);
      process.exit(1);
    });
}

export { migrateMaterialRecordsToMySQL };
