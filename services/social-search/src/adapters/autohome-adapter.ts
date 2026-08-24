import { spawn } from 'child_process';
import path from 'path';
import { BaseAdapter, SearchResult, ContentDetail, SearchOptions, AdapterError } from './base-adapter';
import { withRetry } from '../infra/retry';
import { checkRateLimit, randomDelay } from '../infra/rate-limiter';
import { cacheGet, cacheSet, buildCacheKey } from '../infra/cache';
import { getConfig } from '../config/default';

export class AutohomeAdapter extends BaseAdapter {
  readonly platform = 'autohome';

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, maxResults = 10, summaryMode = false, noCache = false } = options;

    // 缓存检查
    const cacheKey = buildCacheKey('autohome', 'search', { query, maxResults });
    if (!noCache) {
      const cached = await cacheGet<SearchResult[]>(cacheKey);
      if (cached) return cached;
    }

    // 频率控制
    const config = getConfig();
    const rateResult = await checkRateLimit('platform:autohome', config.rateLimit.perPlatformPerMinute);
    if (!rateResult.allowed) {
      await new Promise(resolve => setTimeout(resolve, (rateResult.retryAfter || 5) * 1000));
    }

    await randomDelay(2000, 5000);

    const results = await withRetry(async () => {
      return await this.searchViaPython(query, maxResults);
    }, { maxRetries: 2 });

    // 处理摘要
    const processed = results.map(r => ({
      ...r,
      snippet: this.truncateSnippet(r.snippet, summaryMode),
    }));

    await cacheSet(cacheKey, processed, config.cache.ttl);
    return processed;
  }

  async getContent(params: Record<string, string>): Promise<ContentDetail | AdapterError> {
    const { postUrl } = params;
    if (!postUrl) {
      return { error: 'INVALID_PARAMS', message: '缺少 postUrl 参数' };
    }

    try {
      const content = await withRetry(async () => {
        return await this.getDetailViaPython(postUrl);
      }, { maxRetries: 2 });
      return content;
    } catch (err: any) {
      if (err.message.includes('不存在') || err.message.includes('404')) {
        return { error: 'POST_NOT_FOUND', message: '帖子不存在或已被删除' };
      }
      return { error: 'FETCH_FAILED', message: err.message };
    }
  }

  /**
   * 通过 Python Playwright 脚本搜索汽车之家
   */
  private searchViaPython(query: string, maxResults: number): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const config = getConfig();
      const scriptPath = path.join(config.scriptsDir, 'test_autohome.py');

      const args = [scriptPath, query, maxResults.toString(), '--fetch-content'];

      const pyProcess = spawn(config.pythonExecutable, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      let output = '';
      let errorOutput = '';

      pyProcess.stdout.on('data', (data: Buffer) => { output += data.toString(); });
      pyProcess.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

      pyProcess.on('close', (code) => {
        if (code !== 0) {
          console.warn('[autohome] Python stderr:', errorOutput);
          reject(new Error(`Python 退出码 ${code}: ${errorOutput || output}`));
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          if (!result.success) {
            reject(new Error(result.error || '搜索失败'));
            return;
          }

          const posts = result.results || [];
          const results: SearchResult[] = posts.map((post: any) => ({
            title: post.title || '无标题',
            snippet: post.content ? post.content.substring(0, 300) : '',
            author: post.author || '未知用户',
            url: post.url || '',
            publishedAt: post.publish_time || undefined,
            extra: {
              replies: post.replies || 0,
              views: post.views || 0,
              content: post.content || '',
              images: post.images || [],
            },
          }));

          resolve(results);
        } catch (e: any) {
          reject(new Error(`JSON 解析失败: ${e.message}`));
        }
      });

      pyProcess.on('error', (err) => {
        reject(new Error(`Python 进程启动失败: ${err.message}`));
      });
    });
  }

  /**
   * 通过 Python 脚本获取汽车之家帖子详情
   */
  private getDetailViaPython(postUrl: string): Promise<ContentDetail> {
    return new Promise((resolve, reject) => {
      const config = getConfig();
      const scriptPath = path.join(config.scriptsDir, 'test_autohome.py');

      const args = [scriptPath, '--detail', postUrl];

      const pyProcess = spawn(config.pythonExecutable, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      let output = '';
      let errorOutput = '';

      pyProcess.stdout.on('data', (data: Buffer) => { output += data.toString(); });
      pyProcess.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

      pyProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python 退出码 ${code}: ${errorOutput || output}`));
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          if (!result.success) {
            reject(new Error(result.error || '获取详情失败'));
            return;
          }

          const d = result.data;
          resolve({
            title: d.title,
            content: d.content,
            author: d.author,
            url: d.url || postUrl,
            extra: {
              postId: d.id,
              likes: d.likes || 0,
              comments: d.comments || 0,
              images: d.images || [],
            },
          });
        } catch (e: any) {
          reject(new Error(`JSON 解析失败: ${e.message}`));
        }
      });

      pyProcess.on('error', (err) => {
        reject(new Error(`Python 进程启动失败: ${err.message}`));
      });
    });
  }
}

export const autohomeAdapter = new AutohomeAdapter();
