/**
 * 测试知乎 Cookie 自动刷新功能
 * 
 * 使用方法:
 * npx tsx scripts/test-zhihu-cookie-refresh.ts
 */

import { ZhihuCookieScanner } from '../src/services/cookie-refresh/zhihu-cookie-scanner';
import { getLogger } from '../src/utils/logger';

const logger = getLogger('test-zhihu-refresh');

async function testZhihuCookieRefresh() {
  logger.info('='.repeat(60));
  logger.info('🧪 知乎 Cookie 自动刷新测试');
  logger.info('='.repeat(60));
  logger.info('');
  
  try {
    const scanner = ZhihuCookieScanner.getInstance();
    
    // 设置状态更新回调
    scanner.setStatusCallback((status) => {
      logger.info(`📱 状态：${status.status} - ${status.message}`);
    });
    
    logger.info('🔄 开始刷新知乎 Cookie...');
    logger.info('💡 提示：将会打开浏览器，请在打开的浏览器中登录知乎');
    logger.info('');
    
    const result = await scanner.refreshCookie();
    
    logger.info('');
    logger.info('='.repeat(60));
    
    if (result.success) {
      logger.info(`✅ 测试成功！`);
      logger.info(`   - Cookie 版本：${result.version}`);
      logger.info(`   - 已保存到数据库`);
    } else {
      logger.info(`❌ 测试失败！`);
      logger.info(`   - 错误信息：${result.error}`);
    }
    
    logger.info('='.repeat(60));
    
  } catch (error) {
    logger.error('测试失败:', error instanceof Error ? error.message : String(error));
    logger.error('堆栈跟踪:', error instanceof Error ? error.stack : 'N/A');
  }
}

// 运行测试
testZhihuCookieRefresh();
