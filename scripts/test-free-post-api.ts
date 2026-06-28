/**
 * 自由发帖 API 测试脚本
 * 直接调用 API 执行发帖，用于手动测试和验证
 * 
 * 使用方法：
 * npx ts-node scripts/test-free-post-api.ts
 */

import { AutoPostService } from '../src/services/auto-post';
import { RealAudiApi } from '../src/api/real-client';
import { AuthService } from '../src/services/auth';
import { getLogger } from '../src/utils/logger';
import { postLoggingService } from '../src/services/post-logging-service';

const logger = getLogger('test-free-post-api');

async function main() {
  console.log('='.repeat(60));
  console.log('自由发帖 API 测试脚本');
  console.log('='.repeat(60));
  console.log('');

  try {
    // 1. 初始化服务
    console.log('📦 初始化服务...');
    const api = new RealAudiApi();
    const authService = await AuthService.create(api);
    const postService = new AutoPostService(api, authService);
    console.log('✓ 服务初始化完成\n');

    // 2. 执行自由发帖
    console.log('🚀 开始执行自由发帖...');
    const startTime = Date.now();
    
    const results = await postService.performDailyPosts(1, 'normal', true);
    
    const duration = Date.now() - startTime;
    console.log(`✓ 发帖完成，耗时：${(duration / 1000).toFixed(2)}秒\n`);

    // 3. 输出结果
    console.log('📊 发帖结果:');
    console.log('-'.repeat(60));
    
    results.forEach((result, index) => {
      console.log(`\n【帖子 #${index + 1}】`);
      console.log(`  状态：${result.success ? '✅ 成功' : '❌ 失败'}`);
      console.log(`  来源：${result.source || 'N/A'}`);
      console.log(`  模式：${result.mode || 'N/A'}`);
      console.log(`  标题：${result.title || 'N/A'}`);
      console.log(`  帖子 ID: ${result.postId || 'N/A'}`);
      
      if (result.error) {
        console.log(`  错误：${result.error}`);
      }
      
      if (result.content) {
        const snippet = result.content.substring(0, 100) + '...';
        console.log(`  内容摘要：${snippet}`);
      }
      
      if (result.imageUrls && result.imageUrls.length > 0) {
        console.log(`  图片数量：${result.imageUrls.length}张`);
      }
    });
    
    console.log('');
    console.log('-'.repeat(60));

    // 4. 查询发帖日志
    console.log('\n📝 查询发帖日志...');
    try {
      const logs = await postLoggingService.query({
        page: 1,
        limit: 5,
        postType: 'free',
      });
      
      console.log(`✓ 查询到 ${logs.logs.length} 条自由发帖日志`);
      
      if (logs.logs.length > 0) {
        console.log('\n最近 5 条自由发帖日志:');
        logs.logs.forEach((log: any, index: number) => {
          console.log(`\n【日志 #${index + 1}】`);
          console.log(`  时间：${new Date(log.timestamp).toLocaleString('zh-CN')}`);
          console.log(`  标题：${log.title}`);
          console.log(`  状态：${log.status}`);
          console.log(`  触发方式：${log.triggerType}`);
          console.log(`  模式：${log.mode}`);
          
          if (log.error_message) {
            console.log(`  错误信息：${log.error_message}`);
          }
        });
      }
    } catch (error: any) {
      console.warn(`⚠️  查询日志失败：${error.message}`);
    }

    // 5. 总结
    console.log('\n' + '='.repeat(60));
    console.log('测试总结');
    console.log('='.repeat(60));
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`总发帖数：${totalCount}`);
    console.log(`成功：${successCount}`);
    console.log(`失败：${totalCount - successCount}`);
    console.log(`成功率：${((successCount / totalCount) * 100).toFixed(1)}%`);
    console.log(`平均耗时：${(duration / totalCount / 1000).toFixed(2)}秒/帖`);
    
    if (successCount === totalCount) {
      console.log('\n✅ 所有发帖均成功！');
    } else {
      console.log('\n⚠️  部分发帖失败，请检查日志了解详情');
    }
    
    console.log('');
    
  } catch (error: any) {
    console.error('\n❌ 测试执行失败:');
    console.error(`错误信息：${error.message}`);
    console.error(`错误堆栈：${error.stack}`);
    process.exit(1);
  }
}

// 运行测试
main()
  .then(() => {
    console.log('测试完成，即将退出...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('测试异常退出:', error);
    process.exit(1);
  });
