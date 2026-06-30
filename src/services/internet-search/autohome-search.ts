/**
 * 汽车之家搜索服务
 * 
 * 技术实现:
 * 1. 搜索 API: sou.api.autohome.com.cn/v1/search (无需 Cookie)
 * 2. 正文获取：Playwright 打开帖子 URL，使用 .fn-main .post 选择器提取
 * 
 * 注意：
 * - 搜索 API 无需 Cookie 即可调用
 * - 正文提取使用精准选择器 .fn-main .post（已验证）
 * - 默认获取前 3 条帖子的正文（约 15-20 秒）
 */

import { ISearchPlatform, SearchResult } from './platform-base';
import { getLogger } from '../../utils/logger';
import { spawn } from 'child_process';
import path from 'path';

const logger = getLogger('autohome-search');

export class AutohomeSearch implements ISearchPlatform {
  private platformName = 'autohome';
  private platformDisplayName = '汽车之家';

  getPlatformName(): string {
    return this.platformName;
  }

  getPlatformDisplayName(): string {
    return this.platformDisplayName;
  }

  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    try {
      const keyword = keywords.join(' ');
      logger.info(`开始搜索汽车之家："${keyword}"`);

      return await this.searchViaPython(keyword, maxResults);

    } catch (error) {
      logger.error('汽车之家搜索失败:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * 通过 Python 脚本调用搜索 API + Playwright 获取帖子内容
   * 
   * 流程:
   * 1. 调用 Python 脚本（test_autohome.py）
   * 2. Python 脚本执行:
   *    - 搜索 API 获取帖子列表
   *    - 并发获取前 3 条帖子 URL 的正文（使用 asyncio.gather）
   *    - 使用 .fn-main .post 选择器提取正文
   *    - 包含重试机制和 fallback 选择器
   * 3. 解析 JSON 结果并返回
   * 
   * 优化:
   * - 并发获取：同时打开多个帖子 URL（默认 3 个并发）
   * - 重试机制：失败后自动重试 2 次
   * - fallback: 如果 .fn-main .post 失效，尝试其他选择器
   * - 页面监控：记录选择器失效情况
   * 
   * 超时：30 秒（并发获取 3 条约 10-15 秒）
   */
  private async searchViaPython(keyword: string, maxResults: number): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../../../scripts/test_autohome.py');
      const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';

      // 使用 --fetch-content 参数获取正文（默认并发 3 条）
      const args = [scriptPath, keyword, String(maxResults), '--fetch-content'];

      const pyProcess = spawn(pythonExecutable, args);
      let output = '';
      let errorOutput = '';

      pyProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      pyProcess.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      pyProcess.on('close', (code: number) => {
        if (code !== 0) {
          logger.warn(`Python 脚本退出码：${code}, 错误：${errorOutput}`);
          resolve([]);
          return;
        }

        try {
          const result = JSON.parse(output);
          if (!result.success) {
            logger.warn(`搜索失败：${result.error}`);
            resolve([]);
            return;
          }

          const results: SearchResult[] = (result.results || []).map((item: any) => ({
            title: item.title || '无标题',
            content: item.content || '', // Playwright 并发获取的正文
            source: '汽车之家',
            url: item.url || '',
            author: item.author || '未知用户',
            likes: item.replies || 0,
            comments: item.replies || 0,
            imageUrls: item.images || [],
            publishTime: item.publish_time || undefined,
          }));

          const withContentCount = results.filter(r => r.content).length;
          logger.info(`汽车之家搜索完成，返回 ${results.length} 条结果，${withContentCount} 条含正文`);
          resolve(results);

        } catch (e) {
          logger.error(`解析响应失败：${e}, output: ${output}`);
          resolve([]);
        }
      });

      // 超时处理（30 秒，并发获取已优化到 10-15 秒）
      setTimeout(() => {
        pyProcess.kill();
        logger.warn('搜索超时（30 秒）');
        resolve([]);
      }, 30000);
    });
  }

  async testConnection(): Promise<{ success: boolean; resultCount?: number; error?: string }> {
    try {
      const results = await this.search(['奥迪'], 3);
      return {
        success: results.length > 0,
        resultCount: results.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接失败',
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://sou.autohome.com.cn', {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}
