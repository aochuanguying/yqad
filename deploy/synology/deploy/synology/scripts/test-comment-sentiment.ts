/**
 * 评论情感分析功能测试
 * 
 * 测试场景：
 * 1. 添加评论向量到 ChromaDB
 * 2. 相似评论搜索
 * 3. 水军检测（高相似度 + 时间窗口）
 * 4. 情感分类统计
 * 
 * 运行命令：
 * npx ts-node scripts/test-comment-sentiment.ts
 */

import { commentSentimentStorage, CommentVectorMetadata } from '../src/storage/chroma/comment-sentiment-storage';
import { embeddingVectorizer } from '../src/utils/embedding-vectorizer';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('test-comment-sentiment');

async function testCommentSentiment() {
  console.log('='.repeat(60));
  console.log('评论情感分析功能测试');
  console.log('='.repeat(60));
  console.log();

  try {
    // 1. 初始化存储
    console.log('1️⃣  初始化评论情感存储...');
    await commentSentimentStorage.initialize();
    console.log('✅ 初始化成功\n');

    // 2. 添加测试评论
    console.log('2️⃣  添加测试评论向量...');
    const testComments = [
      {
        id: 'comment_001',
        text: '这个活动真不错，很喜欢！',
        sentiment: 'positive' as const,
        score: 0.85,
        postId: 'post_123',
        userId: 'user_001',
      },
      {
        id: 'comment_002',
        text: '太棒了，支持！',
        sentiment: 'positive' as const,
        score: 0.9,
        postId: 'post_123',
        userId: 'user_002',
      },
      {
        id: 'comment_003',
        text: '感觉很失望，体验不好',
        sentiment: 'negative' as const,
        score: 0.2,
        postId: 'post_123',
        userId: 'user_003',
      },
      {
        id: 'comment_004',
        text: '一般般吧，没什么特别的',
        sentiment: 'neutral' as const,
        score: 0.5,
        postId: 'post_123',
        userId: 'user_004',
      },
      // 疑似水军评论（高度相似）
      {
        id: 'comment_005',
        text: '这个活动真不错，非常喜欢！',
        sentiment: 'positive' as const,
        score: 0.88,
        postId: 'post_123',
        userId: 'user_005',
      },
      {
        id: 'comment_006',
        text: '活动很不错，很喜欢',
        sentiment: 'positive' as const,
        score: 0.82,
        postId: 'post_123',
        userId: 'user_006',
      },
    ];

    for (const comment of testComments) {
      const embedding = await embeddingVectorizer.generateEmbedding(comment.text);
      const metadata: CommentVectorMetadata = {
        comment_id: comment.id,
        comment_text: comment.text,
        sentiment: comment.sentiment,
        sentiment_score: comment.score,
        post_id: comment.postId,
        user_id: comment.userId,
        created_at: Date.now(),
      };
      await commentSentimentStorage.addCommentVector(comment.id, embedding, metadata);
      console.log(`   ✅ 添加评论：${comment.id} (${comment.sentiment})`);
    }
    console.log();

    // 3. 相似评论搜索
    console.log('3️⃣  相似评论搜索...');
    const query = '这个活动很好';
    const queryEmbedding = await embeddingVectorizer.generateEmbedding(query);
    const similarComments = await commentSentimentStorage.searchSimilarComments(
      queryEmbedding,
      5,
      0.7
    );

    console.log(`   🔍 查询："${query}"`);
    console.log(`   📊 找到 ${similarComments.length} 条相似评论：`);
    for (const comment of similarComments) {
      console.log(
        `      - ${comment.commentId}: "${comment.metadata.comment_text}" ` +
        `(相似度：${(comment.similarity * 100).toFixed(1)}%)`
      );
    }
    console.log();

    // 4. 水军检测
    console.log('4️⃣  水军检测...');
    const suspiciousComments = await commentSentimentStorage.detectSuspiciousComments(
      queryEmbedding,
      3600,  // 1 小时窗口
      0.85   // 高相似度阈值
    );

    if (suspiciousComments.length > 0) {
      console.log(`   ⚠️  检测到 ${suspiciousComments.length} 条疑似水军评论：`);
      for (const comment of suspiciousComments) {
        console.log(
          `      - ${comment.commentId}: "${comment.metadata.comment_text}" ` +
          `(相似度：${(comment.similarity * 100).toFixed(1)}%, 用户：${comment.metadata.user_id})`
        );
      }
    } else {
      console.log('   ✅ 未检测到疑似水军评论');
    }
    console.log();

    // 5. 情感统计
    console.log('5️⃣  情感统计...');
    const [positive, negative, neutral] = await Promise.all([
      commentSentimentStorage.getCommentsBySentiment('positive', 100),
      commentSentimentStorage.getCommentsBySentiment('negative', 100),
      commentSentimentStorage.getCommentsBySentiment('neutral', 100),
    ]);

    const total = positive.length + negative.length + neutral.length;
    console.log(`   📊 总评论数：${total}`);
    console.log(`   📊 正面：${positive.length} (${((positive.length / total) * 100).toFixed(1)}%)`);
    console.log(`   📊 负面：${negative.length} (${((negative.length / total) * 100).toFixed(1)}%)`);
    console.log(`   📊 中性：${neutral.length} (${((neutral.length / total) * 100).toFixed(1)}%)`);
    console.log();

    // 6. 统计信息
    console.log('6️⃣  统计信息...');
    const count = await commentSentimentStorage.count();
    console.log(`   📊 向量总数：${count}`);
    const info = await commentSentimentStorage.getCollectionInfo();
    console.log(`   📊 Collection: ${info?.name || 'N/A'}`);
    console.log();

    console.log('✅ 测试完成！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testCommentSentiment();
