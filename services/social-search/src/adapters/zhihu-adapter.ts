import { spawn } from 'child_process';
import * as path from 'path';
import { BaseAdapter, SearchResult, ContentDetail, SearchOptions, AdapterError } from './base-adapter';
import { cookiePool } from '../infra/cookie-pool';
import { withRetry } from '../infra/retry';
import { checkRateLimit, randomDelay } from '../infra/rate-limiter';
import { cacheGet, cacheSet, buildCacheKey } from '../infra/cache';
import { getConfig } from '../config/default';

export class ZhihuAdapter extends BaseAdapter {
  readonly platform = 'zhihu';

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, type = 'general', maxResults = 10, summaryMode = false, noCache = false } = options;

    // 缓存检查
    const cacheKey = buildCacheKey('zhihu', 'search', { query, type, maxResults });
    if (!noCache) {
      const cached = await cacheGet<SearchResult[]>(cacheKey);
      if (cached) return cached;
    }

    // 频率控制
    const config = getConfig();
    const rateResult = await checkRateLimit('platform:zhihu', config.rateLimit.perPlatformPerMinute);
    if (!rateResult.allowed) {
      await new Promise(resolve => setTimeout(resolve, (rateResult.retryAfter || 5) * 1000));
    }

    await randomDelay();

    // 获取 access_secret（优先从配置，其次从数据库）
    const accessSecret = await this.getAccessSecret();
    if (!accessSecret) {
      console.warn('[zhihu] 无 access_secret，退回到 Cookie API 搜索');
      return this.searchViaCookieApi(query, type, maxResults, summaryMode);
    }

    const results = await withRetry(async () => {
      return await this.searchViaOfficialApi(query, maxResults, accessSecret);
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
    const { url } = params;
    if (!url) {
      return { error: 'INVALID_PARAMS', message: '缺少 url 参数' };
    }

    const cookie = cookiePool.get('zhihu');
    const config = getConfig();
    const accessSecret = await this.getAccessSecret();

    try {
      const content = await withRetry(async () => {
        return await this.fetchContentViaPython(url, accessSecret, cookie || '');
      }, { maxRetries: 2 });
      return content;
    } catch (err: any) {
      return { error: 'FETCH_FAILED', message: err.message };
    }
  }

  /**
   * 获取 access_secret（优先环境变量/配置，其次从数据库）
   */
  private async getAccessSecret(): Promise<string> {
    const config = getConfig();
    if (config.zhihuAccessSecret) {
      return config.zhihuAccessSecret;
    }

    // 尝试从数据库获取
    try {
      const mysql = await import('mysql2/promise');
      const conn = await mysql.createConnection({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
      });
      const [rows] = await conn.query(
        'SELECT zhihu_access_secret FROM network_post_config WHERE enabled = 1 LIMIT 1'
      ) as any;
      await conn.end();

      if (rows.length > 0 && rows[0].zhihu_access_secret) {
        return rows[0].zhihu_access_secret;
      }
    } catch (err: any) {
      console.warn('[zhihu] 从数据库获取 access_secret 失败:', err.message);
    }

    return '';
  }

  /**
   * 使用知乎官方开发者 API 搜索
   */
  private async searchViaOfficialApi(query: string, maxResults: number, accessSecret: string): Promise<SearchResult[]> {
    const url = `https://developer.zhihu.com/api/v1/content/zhihu_search?Query=${encodeURIComponent(query)}&Count=${maxResults}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessSecret}`,
        'X-Request-Timestamp': timestamp.toString(),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`知乎 API HTTP ${response.status}`);
    }

    const data: any = await response.json();
    if (data.Code !== 0) {
      throw new Error(`知乎 API 错误: Code=${data.Code}, Message=${data.Message}`);
    }

    const items = data.Data?.Items || [];
    return items.map((item: any) => ({
      title: item.Title || '',
      snippet: item.ContentText || '',
      author: item.AuthorName || '',
      url: item.Url || '',
      extra: {
        type: item.ContentType || 'unknown',
        contentId: item.ContentID || '',
        voteCount: item.VoteUpCount || 0,
        commentCount: item.CommentCount || 0,
      },
    }));
  }

  /**
   * 退回方案：使用 Cookie 直接调用知乎 v4 API
   */
  private async searchViaCookieApi(query: string, type: string, maxResults: number, summaryMode: boolean): Promise<SearchResult[]> {
    const cookie = cookiePool.get('zhihu');
    if (!cookie) return [];

    const searchType = type === 'article' ? 'column' : 'general';
    const url = `https://www.zhihu.com/api/v4/search_v3?t=${searchType}&q=${encodeURIComponent(query)}&offset=0&limit=${maxResults}`;

    const response = await fetch(url, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.zhihu.com/',
      },
    });

    if (response.status === 401 || response.status === 403) {
      cookiePool.markInvalid('zhihu', cookie);
      return [];
    }

    if (!response.ok) return [];

    const data: any = await response.json();
    if (!data || !data.data) return [];

    return data.data.map((item: any) => {
      const obj = item.object || item;
      return {
        title: this.stripHtml(obj?.title || obj?.question?.title || ''),
        snippet: this.truncateSnippet(this.stripHtml(obj?.excerpt || obj?.content || ''), summaryMode),
        author: obj?.author?.name || '',
        url: obj?.url || '',
        publishedAt: obj?.created_time ? new Date(obj.created_time * 1000).toISOString() : undefined,
        extra: {
          type: item.type || 'unknown',
          voteCount: obj?.voteup_count || 0,
          commentCount: obj?.comment_count || 0,
        },
      };
    }).filter((r: SearchResult) => r.title);
  }

  /**
   * 使用 Python Playwright 提取知乎正文和图片
   */
  private fetchContentViaPython(url: string, accessSecret: string, cookie: string): Promise<ContentDetail> {
    return new Promise((resolve, reject) => {
      const config = getConfig();
      const scriptPath = path.join(config.scriptsDir, 'test_zhihu_content.py');

      const inputData = JSON.stringify({
        accessSecret,
        cookie,
        results: [{ Url: url, Title: '', ContentText: '' }],
      });

      const pyProcess = spawn(config.pythonExecutable, [scriptPath, '--from-stdin'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      pyProcess.stdin.write(inputData);
      pyProcess.stdin.end();

      let output = '';
      let errorOutput = '';

      pyProcess.stdout.on('data', (data: Buffer) => { output += data.toString(); });
      pyProcess.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

      pyProcess.on('close', (code) => {
        if (code !== 0) {
          // Playwright 不可用时退回到 API 方式
          console.warn('[zhihu] Playwright 提取失败，退回到 API 方式:', errorOutput.substring(0, 200));
          this.fetchContentViaApi(url, cookie)
            .then(resolve)
            .catch(reject);
          return;
        }

        try {
          // 解析 Python 输出（跳过日志行，找 JSON）
          const lines = output.split('\n');
          let jsonStr = '';
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().startsWith('{')) {
              jsonStr = lines.slice(i).join('\n');
              break;
            }
          }

          const result = JSON.parse(jsonStr);
          if (!result.success || !result.results || result.results.length === 0) {
            reject(new Error('Python 脚本未返回有效结果'));
            return;
          }

          const item = result.results[0];
          resolve({
            title: item.title || '',
            content: item.content || '',
            author: item.author || '',
            url,
            extra: {
              images: item.images || [],
              voteCount: item.likes || 0,
              commentCount: item.comments || 0,
            },
          });
        } catch (e: any) {
          reject(new Error(`解析 Python 输出失败: ${e.message}`));
        }
      });

      pyProcess.on('error', (err) => {
        // Playwright 不可用时退回到 API
        console.warn('[zhihu] Python 进程启动失败:', err.message);
        this.fetchContentViaApi(url, cookie)
          .then(resolve)
          .catch(reject);
      });
    });
  }

  /**
   * 退回方案：通过 API 获取内容（无图片）
   */
  private async fetchContentViaApi(url: string, cookie: string): Promise<ContentDetail> {
    let apiUrl: string;
    if (url.includes('zhuanlan.zhihu.com/p/')) {
      const id = url.split('/p/')[1]?.split(/[?#]/)[0];
      apiUrl = `https://www.zhihu.com/api/v4/articles/${id}`;
    } else if (url.includes('/answer/')) {
      const id = url.split('/answer/')[1]?.split(/[?#]/)[0];
      apiUrl = `https://www.zhihu.com/api/v4/answers/${id}?include=content`;
    } else {
      throw new Error('不支持的 URL 格式');
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.zhihu.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`知乎 API HTTP ${response.status}`);
    }

    const data: any = await response.json();
    const html = data.content || '';

    // 从 HTML 提取图片（优先 data-actualsrc，其次 src 中的 https 链接）
    const images: string[] = [];
    const actualSrcRegex = /data-actualsrc="([^"]+)"/g;
    let match;
    while ((match = actualSrcRegex.exec(html)) !== null) {
      images.push(match[1]);
    }
    if (images.length === 0) {
      const srcRegex = /src="(https:\/\/pic[^"]+)"/g;
      while ((match = srcRegex.exec(html)) !== null) {
        images.push(match[1]);
      }
    }

    return {
      title: data.title || data.question?.title || '',
      content: this.htmlToMarkdown(html),
      author: data.author?.name || '',
      url,
      extra: {
        images,
        voteCount: data.voteup_count || 0,
        commentCount: data.comment_count || 0,
      },
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  }

  private htmlToMarkdown(html: string): string {
    return html
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n## $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

export const zhihuAdapter = new ZhihuAdapter();
