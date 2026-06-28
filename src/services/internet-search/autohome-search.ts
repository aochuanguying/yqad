/**
 * 汽车之家搜索服务
 * 1. 使用 sou.api.autohome.com.cn 搜索 API 获取帖子列表
 * 2. 使用 Playwright 打开帖子 URL 获取正文内容
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
   */
  private async searchViaPython(keyword: string, maxResults: number): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../../../scripts/test_autohome.py');
      const pythonExecutable = process.env.PYTHON_EXECUTABLE || 'python3';

      // 使用 --fetch-content 参数获取正文
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
            content: item.content || '', // Playwright 获取的正文
            source: '汽车之家',
            url: item.url || '',
            author: item.author || '未知用户',
            likes: item.replies || 0,
            comments: item.replies || 0,
            imageUrls: item.images || [],
            publishTime: item.publish_time || undefined,
          }));

          logger.info(`汽车之家搜索完成，返回 ${results.length} 条结果`);
          resolve(results);

        } catch (e) {
          logger.error(`解析响应失败：${e}, output: ${output}`);
          resolve([]);
        }
      });

      // 超时处理（30 秒，因为 Playwright 比较慢）
      setTimeout(() => {
        pyProcess.kill();
        logger.warn('搜索超时');
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
