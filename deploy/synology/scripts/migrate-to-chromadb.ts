#!/usr/bin/env ts-node
/**
 * ChromaDB 数据迁移脚本（使用专业 Embedding）
 * 
 * 功能：
 * 1. 从 MySQL 读取素材元数据
 * 2. 生成素材向量（使用 OpenAI Embedding API）
 * 3. 将向量存储到 ChromaDB
 * 4. 从 MySQL 读取历史发帖内容
 * 5. 生成内容向量并存储到 ChromaDB
 * 
 * 使用方法：
 *   npx ts-node scripts/migrate-to-chromadb.ts
 * 
 * 前置条件：
 * 1. MySQL 数据库已初始化并包含数据
 * 2. ChromaDB 服务已启动
 * 3. 已安装 chromadb 包：npm install chromadb
 * 4. 已配置 AI Provider API Key
 * 
 * 环境配置：
 * - 本地开发：CHROMADB_URL=http://10.6.0.5:8000
 * - 生产环境：CHROMADB_URL=http://chromadb:8000
 */

import * as mysql from 'mysql2/promise';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ChromaClient } from 'chromadb';
import { embeddingVectorizer } from '../src/utils/embedding-vectorizer';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 配置
const config = {
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'yqad_db',
  },
  chromadb: {
    url: process.env.CHROMADB_URL || (process.env.NODE_ENV === 'production' 
      ? 'http://chromadb:8000' 
      : 'http://10.6.0.5:8000'),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    prefix: process.env.REDIS_PREFIX || 'dev:',
  },
};

console.log('🚀 开始迁移数据到 ChromaDB...');
console.log('');
console.log('📊 配置信息:');
console.log(`   环境：${process.env.NODE_ENV || 'development'}`);
console.log(`   MySQL: ${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`);
console.log(`   ChromaDB: ${config.chromadb.url}`);
console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);
console.log('');

// 估算成本
const estimatedCost = embeddingVectorizer.estimateCost(['example text']);
console.log('💰 预估成本:');
console.log(`   每 1000 条文本约 ${estimatedCost.tokens} tokens, $${estimatedCost.costUSD}`);
console.log('');

/**
 * 初始化 MySQL 连接
 */
async function initMySQL() {
  try {
    const pool = mysql.createPool({
      ...config.mysql,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });

    // 测试连接
    const connection = await pool.getConnection();
    console.log('✅ MySQL 连接成功');
    connection.release();

    return pool;
  } catch (error) {
    console.error('❌ MySQL 连接失败');
    console.error(`   错误：${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * 初始化 ChromaDB 客户端
 */
async function initChromaDB() {
  try {
    const chroma = new ChromaClient({
      path: config.chromadb.url,
    });

    // 测试连接
    const collections = await chroma.listCollections();
    console.log('✅ ChromaDB 连接成功');
    console.log(`   可用 Collection: ${collections.map(c => c.name).join(', ')}`);

    return chroma;
  } catch (error) {
    console.error('❌ ChromaDB 连接失败');
    console.error(`   错误：${error instanceof Error ? error.message : String(error)}`);
    console.error('');
    console.error('请检查：');
    console.error('   1. ChromaDB 服务是否已启动');
    console.error('   2. CHROMADB_URL 环境变量是否正确');
    console.error('   3. 网络连接是否正常');
    throw error;
  }
}

/**
 * 迁移素材数据到 ChromaDB
 */
async function migrateMaterials(mysqlPool: mysql.Pool, chroma: ChromaClient) {
  console.log('');
  console.log('📦 开始迁移素材数据...');
  console.log('');

  try {
    // 获取或创建 Collection
    let collection;
    try {
      collection = await chroma.getCollection({ name: 'materials' });
      console.log('   使用现有 Collection: materials');
    } catch (error) {
      collection = await chroma.createCollection({
        name: 'materials',
        metadata: {
          description: 'Material embeddings for similarity search',
          dimension: 512,
        },
      });
      console.log('   创建新 Collection: materials');
    }

    const vectorizer = new SimpleVectorizer();
    
    // 从 MySQL 读取素材
    const [rows] = await mysqlPool.query<any[]>(
      `SELECT id, file_path, file_name, file_type, description, tags 
       FROM material_records 
       WHERE is_available = TRUE 
       LIMIT 1000`
    );

    console.log(`   读取到 ${rows.length} 条素材记录`);

    if (rows.length === 0) {
      console.log('   ⚠️  无素材数据，跳过迁移');
      return;
    }

    // 准备向量数据
    const ids: string[] = [];
    const embeddings: number[][] = [];
    const metadatas: Array<Record<string, any>> = [];

    // 收集所有描述用于训练 IDF
    const descriptions = rows
      .map(r => `${r.file_name || ''} ${r.description || ''} ${r.tags ? JSON.stringify(r.tags) : ''}`)
      .filter(t => t.trim().length > 0);

    // 构建文本
    const texts = rows.map(r => 
      `${r.file_name || ''} ${r.description || ''} ${r.tags ? JSON.stringify(r.tags) : ''}`.trim()
    ).filter(t => t.length > 0);

    console.log(`   生成向量（使用 OpenAI Embedding）...`);
    // 批量生成向量（使用专业 Embedding）
    const embeddings = await embeddingVectorizer.batchGenerateEmbeddings(texts, 10);
    
    // 准备 ID 和元数据
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!texts[i]) continue;
      
      ids.push(`material_${row.id}`);
      metadatas.push({
        file_path: row.file_path,
        file_name: row.file_name || '',
        file_type: row.file_type || 'image',
        description: row.description || '',
        tags: row.tags ? (typeof row.tags === 'string' ? row.tags : JSON.stringify(row.tags)) : '',
        created_at: Date.now(),
      });
    }

    console.log(`   生成 ${embeddings.length} 个向量（${embeddings[0]?.length || 0}维）`);

    // 批量添加到 ChromaDB
    if (embeddings.length > 0) {
      console.log('   写入 ChromaDB...');
      
      // 分批处理（每批 100 条）
      const batchSize = 100;
      for (let i = 0; i < embeddings.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchEmbeddings = embeddings.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);

        await collection.add({
          ids: batchIds,
          embeddings: batchEmbeddings,
          metadatas: batchMetadatas,
        });

        console.log(`     已处理 ${Math.min(i + batchSize, embeddings.length)}/${embeddings.length} 条`);
      }

      console.log('✅ 素材数据迁移完成');
    } else {
      console.log('⚠️  无有效向量数据，跳过迁移');
    }
  } catch (error) {
    console.error('❌ 素材数据迁移失败');
    console.error(`   错误：${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * 迁移历史发帖内容到 ChromaDB
 */
async function migrateContentDedup(mysqlPool: mysql.Pool, chroma: ChromaClient) {
  console.log('');
  console.log('📝 开始迁移历史发帖内容...');
  console.log('');

  try {
    // 获取或创建 Collection
    let collection;
    try {
      collection = await chroma.getCollection({ name: 'content_dedup' });
      console.log('   使用现有 Collection: content_dedup');
    } catch (error) {
      collection = await chroma.createCollection({
        name: 'content_dedup',
        metadata: {
          description: 'Post content embeddings for duplication detection',
          dimension: 512,
        },
      });
      console.log('   创建新 Collection: content_dedup');
    }

    const vectorizer = new SimpleVectorizer();

    // 从 MySQL 读取历史发帖
    const [rows] = await mysqlPool.query<any[]>(
      `SELECT id, title, content, topic 
       FROM post_history 
       WHERE title IS NOT NULL AND content IS NOT NULL
       ORDER BY published_at DESC
       LIMIT 1000`
    );

    console.log(`   读取到 ${rows.length} 条历史发帖记录`);

    if (rows.length === 0) {
      console.log('   ⚠️  无历史发帖数据，跳过迁移');
      return;
    }

    // 准备向量数据
    const ids: string[] = [];
    const embeddings: number[][] = [];
    const metadatas: Array<Record<string, any>> = [];

    // 收集所有文本用于训练 IDF
    const texts = rows
      .map(r => `${r.title} ${r.content || ''}`)
      .filter(t => t.trim().length > 0);

    // 构建文本
    const texts = rows.map(r => `${r.title} ${r.content || ''}`.trim()).filter(t => t.length > 0);
    
    console.log(`   生成向量（使用 OpenAI Embedding）...`);
    // 批量生成向量
    const embeddings = await embeddingVectorizer.batchGenerateEmbeddings(texts, 10);
    
    // 准备 ID 和元数据
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!texts[i]) continue;
      
      ids.push(`post_${row.id}`);
      metadatas.push({
        title: row.title,
        topic: row.topic || '',
        created_at: Date.now(),
      });
    }

    console.log(`   生成 ${embeddings.length} 个向量（${embeddings[0]?.length || 0}维）`);

    // 批量添加到 ChromaDB
    if (embeddings.length > 0) {
      console.log('   写入 ChromaDB...');
      
      // 分批处理（每批 100 条）
      const batchSize = 100;
      for (let i = 0; i < embeddings.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchEmbeddings = embeddings.slice(i, i + batchSize);
        const batchMetadatas = metadatas.slice(i, i + batchSize);

        await collection.add({
          ids: batchIds,
          embeddings: batchEmbeddings,
          metadatas: batchMetadatas,
        });

        console.log(`     已处理 ${Math.min(i + batchSize, embeddings.length)}/${embeddings.length} 条`);
      }

      console.log('✅ 历史发帖内容迁移完成');
    } else {
      console.log('⚠️  无有效向量数据，跳过迁移');
    }
  } catch (error) {
    console.error('❌ 历史发帖内容迁移失败');
    console.error(`   错误：${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  let mysqlPool: mysql.Pool | null = null;
  let exitCode = 0;

  try {
    // 1. 初始化连接
    console.log('🔌 初始化数据库连接...');
    console.log('');
    
    mysqlPool = await initMySQL();
    const chroma = await initChromaDB();

    console.log('');
    console.log('🔄 开始迁移数据...');
    console.log('');

    // 2. 迁移素材数据
    await migrateMaterials(mysqlPool, chroma);

    // 3. 迁移历史发帖内容
    await migrateContentDedup(mysqlPool, chroma);

    console.log('');
    console.log('🎉 所有数据迁移完成！');
    console.log('');
    console.log('下一步：');
    console.log('  1. 验证 ChromaDB 数据：使用 ChromaDB UI 或 API 查询');
    console.log('  2. 更新应用代码，使用 ChromaDB 进行相似度搜索');
    console.log('  3. 测试相似度搜索功能');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('💥 数据迁移失败');
    console.error(`   错误：${error instanceof Error ? error.message : String(error)}`);
    console.error('');
    exitCode = 1;
  } finally {
    // 关闭连接
    if (mysqlPool) {
      await mysqlPool.end();
      console.log('🔌 MySQL 连接已关闭');
    }
    
    process.exit(exitCode);
  }
}

// 执行主函数
main();
