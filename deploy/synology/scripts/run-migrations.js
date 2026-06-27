/**
 * 执行数据库迁移
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('开始执行数据库迁移...');
  
  // 连接数据库
  const connection = await mysql.createConnection({
    host: '192.168.50.50',
    user: 'root',
    password: 'Wfw7539148@',
    database: 'yqad_db',
  });

  try {
    // 读取并执行 SQL 脚本
    const sqlScript = fs.readFileSync(path.join(__dirname, 'create-topics-tables.sql'), 'utf-8');
    const statements = sqlScript.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement);
        console.log('✓ 执行 SQL 成功');
      }
    }
    
    console.log('✅ 表结构创建完成');
    
    // 迁移 topics.json
    const topicsPath = path.join(__dirname, '../data/topics.json');
    if (fs.existsSync(topicsPath)) {
      const topicsData = fs.readFileSync(topicsPath, 'utf-8');
      const topics = JSON.parse(topicsData);
      console.log(`读取到 ${topics.length} 个主题，开始迁移...`);
      
      for (const topic of topics) {
        // 插入主题
        await connection.execute(`
          INSERT INTO topics (id, name, max_use_count, current_use_count, status, tags, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            max_use_count = VALUES(max_use_count),
            current_use_count = VALUES(current_use_count),
            status = VALUES(status),
            tags = VALUES(tags),
            updated_at = CURRENT_TIMESTAMP
        `, [
          topic.id,
          topic.name,
          topic.maxUseCount || 1,
          topic.currentUseCount || 0,
          topic.status || 'available',
          topic.tags ? JSON.stringify(topic.tags) : null,
          topic.createdAt || new Date().toISOString(),
          topic.updatedAt || new Date().toISOString(),
        ]);
        
        // 插入子方向
        if (topic.subDirections && topic.subDirections.length > 0) {
          for (const sub of topic.subDirections) {
            await connection.execute(`
              INSERT INTO topic_sub_directions (id, topic_id, name)
              VALUES (?, ?, ?)
              ON DUPLICATE KEY UPDATE name = VALUES(name)
            `, [sub.id, topic.id, sub.name]);
          }
        }
      }
      
      console.log(`✅ 成功迁移 ${topics.length} 个主题到 MySQL`);
    } else {
      console.log('⚠️  topics.json 不存在，跳过迁移');
    }
    
    // 迁移 material-records.json
    const recordsPath = path.join(__dirname, '../data/material-records.json');
    if (fs.existsSync(recordsPath)) {
      const recordsData = fs.readFileSync(recordsPath, 'utf-8');
      const records = JSON.parse(recordsData);
      console.log(`读取到 ${records.length} 条素材记录，开始迁移...`);
      
      for (const record of records) {
        await connection.execute(`
          INSERT INTO material_records (
            id, original_path, processed_path, original_hash, processed_hash,
            file_size, width, height, format, is_watermark, ocr_text, description,
            tags, source_type, internet_url, used_count, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            original_path = VALUES(original_path),
            processed_path = VALUES(processed_path),
            used_count = VALUES(used_count),
            updated_at = CURRENT_TIMESTAMP
        `, [
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
          record.createdAt,
          record.updatedAt,
        ]);
      }
      
      console.log(`✅ 成功迁移 ${records.length} 条素材记录到 MySQL`);
    } else {
      console.log('⚠️  material-records.json 不存在，跳过迁移');
    }
    
    console.log('\n🎉 所有迁移完成！');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// 执行迁移
runMigrations()
  .then(() => {
    console.log('完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
