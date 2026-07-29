import { spawn } from 'child_process';
import { BaseAdapter, SearchResult, ContentDetail, SearchOptions, AdapterError } from './base-adapter';
import { cookiePool } from '../infra/cookie-pool';
import { withRetry } from '../infra/retry';
import { checkRateLimit, randomDelay } from '../infra/rate-limiter';
import { cacheGet, cacheSet, buildCacheKey } from '../infra/cache';
import { getConfig } from '../config/default';

export class XiaohongshuAdapter extends BaseAdapter {
  readonly platform = 'xiaohongshu';

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, sortBy = 'relevance', maxResults = 10, summaryMode = false, noCache = false } = options;

    // 缓存检查
    const cacheKey = buildCacheKey('xiaohongshu', 'search', { query, sortBy, maxResults });
    if (!noCache) {
      const cached = await cacheGet<SearchResult[]>(cacheKey);
      if (cached) return cached;
    }

    // 频率控制
    const config = getConfig();
    const rateResult = await checkRateLimit('platform:xiaohongshu', config.rateLimit.perPlatformPerMinute);
    if (!rateResult.allowed) {
      await new Promise(resolve => setTimeout(resolve, (rateResult.retryAfter || 5) * 1000));
    }

    await randomDelay(2000, 5000);

    const cookie = cookiePool.get('xiaohongshu');
    if (!cookie) {
      return [];
    }

    const results = await withRetry(async () => {
      return await this.searchViaPython(query, sortBy, maxResults, cookie);
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
    const { noteId, xsecToken } = params;
    if (!noteId) {
      return { error: 'INVALID_PARAMS', message: '缺少 noteId 参数' };
    }

    const cookie = cookiePool.get('xiaohongshu');
    if (!cookie) {
      return { error: 'NO_VALID_COOKIE', message: '无可用 Cookie，请刷新' };
    }

    try {
      const content = await withRetry(async () => {
        return await this.getDetailViaPython(noteId, xsecToken || '', cookie);
      }, { maxRetries: 2 });
      return content;
    } catch (err: any) {
      if (err.message.includes('不存在')) {
        return { error: 'NOTE_NOT_FOUND', message: '笔记不存在或已被删除' };
      }
      return { error: 'FETCH_FAILED', message: err.message };
    }
  }

  /**
   * 通过 Python xhshow 库搜索小红书
   */
  private searchViaPython(query: string, sortBy: string, maxResults: number, cookie: string): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
      const config = getConfig();
      const sort = sortBy === 'latest' ? 'time_descending' : 'general';

      const pythonScript = `
import json
import sys
import time
import random
import requests
from xhshow import Xhshow

try:
    cookie = sys.argv[1]
    keyword = sys.argv[2]
    max_results = int(sys.argv[3])
    sort = sys.argv[4]

    time.sleep(random.uniform(1, 3))

    cookie_dict = {}
    for item in cookie.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()

    client = Xhshow()
    search_id = client.get_search_request_id()

    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    uri = "/api/sns/web/v2/search/notes"

    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": max(max_results, 10),
        "search_id": search_id,
        "sort": sort,
        "note_type": 0,
        "extend": {"title_encoding": 1, "desc_encoding": 1}
    }

    headers = client.sign_headers(
        method="POST",
        uri=uri,
        cookies=cookie_dict,
        payload=payload,
        x_rap=False
    )
    headers["Content-Type"] = "application/json"
    headers["Origin"] = "https://www.xiaohongshu.com"
    headers["Referer"] = "https://www.xiaohongshu.com/explore"

    response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)

    if response.status_code != 200:
        print(json.dumps({"error": f"HTTP {response.status_code}"}))
        sys.exit(1)

    result = response.json()

    if not result.get('success'):
        print(json.dumps({"error": result.get('msg', '请求失败')}))
        sys.exit(1)

    items = result.get('data', {}).get('items', [])
    notes = []

    for item in items[:max_results]:
        try:
            note_data = item.get('note_card', {}) or {}
            note_id = item.get('id', '')
            xsec_token = item.get('xsec_token', '')

            note = {
                'id': note_id,
                'title': note_data.get('display_title', '') or note_data.get('title', '') or '',
                'desc': note_data.get('desc', '') or '',
                'author': note_data.get('user', {}).get('nickname', '') or '',
                'authorAvatar': note_data.get('user', {}).get('avatar', '') or '',
                'likeCount': str(note_data.get('interact_info', {}).get('liked_count', 0)),
                'collectCount': str(note_data.get('interact_info', {}).get('collected_count', 0)),
                'commentCount': str(note_data.get('interact_info', {}).get('comment_count', 0)),
                'coverImage': note_data.get('cover', {}).get('url', '') or '',
                'xsecToken': xsec_token,
                'url': f"https://www.xiaohongshu.com/explore/{note_id}" if note_id else ''
            }
            notes.append(note)
        except:
            continue

    print(json.dumps({"success": True, "notes": notes}))

except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
    sys.exit(1)
`;

      const pyProcess = spawn(config.pythonExecutable, [
        '-c', pythonScript, cookie, query, maxResults.toString(), sort
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      let output = '';
      let errorOutput = '';

      pyProcess.stdout.on('data', (data: Buffer) => { output += data.toString(); });
      pyProcess.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

      pyProcess.on('close', (code) => {
        if (code !== 0) {
          console.warn('[xiaohongshu] Python stderr:', errorOutput);
          reject(new Error(`Python 退出码 ${code}: ${errorOutput || output}`));
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          if (result.error) {
            reject(new Error(result.error));
            return;
          }

          const notes = result.notes || [];
          const results: SearchResult[] = notes.map((note: any) => ({
            title: note.title,
            snippet: note.desc,
            author: note.author,
            url: note.url,
            extra: {
              noteId: note.id,
              xsecToken: note.xsecToken,
              coverImage: note.coverImage,
              authorAvatar: note.authorAvatar,
              likeCount: note.likeCount,
              collectCount: note.collectCount,
              commentCount: note.commentCount,
            },
          }));

          resolve(results);
        } catch (e: any) {
          reject(new Error(`JSON 解析失败: ${e.message}, output: ${output.substring(0, 200)}`));
        }
      });

      pyProcess.on('error', (err) => {
        reject(new Error(`Python 进程启动失败: ${err.message}`));
      });
    });
  }

  /**
   * 通过 Python xhshow 库获取笔记详情
   */
  private getDetailViaPython(noteId: string, xsecToken: string, cookie: string): Promise<ContentDetail> {
    return new Promise((resolve, reject) => {
      const config = getConfig();

      const pythonScript = `
import json
import sys
import requests
from xhshow import Xhshow

try:
    cookie = sys.argv[1]
    note_id = sys.argv[2]
    xsec_token = sys.argv[3]

    cookie_dict = {}
    for item in cookie.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()

    client = Xhshow()

    payload = {
        "source_note_id": note_id,
        "image_formats": ["jpg", "webp", "avif"],
        "extra": {"need_body_topic": "1"},
        "xsec_source": "pc_search",
        "xsec_token": xsec_token
    }

    headers = client.sign_headers(
        method="POST",
        uri="/api/sns/web/v1/feed",
        cookies=cookie_dict,
        payload=payload,
        x_rap=True
    )
    headers["Content-Type"] = "application/json"
    headers["Origin"] = "https://www.xiaohongshu.com"
    headers["Referer"] = "https://www.xiaohongshu.com/"

    response = requests.post(
        "https://edith.xiaohongshu.com/api/sns/web/v1/feed",
        headers=headers,
        cookies=cookie_dict,
        json=payload,
        timeout=30
    )

    if response.status_code != 200:
        print(json.dumps({"error": f"HTTP {response.status_code}"}))
        sys.exit(1)

    result = response.json()
    items = result.get('data', {}).get('items', [])

    if not items:
        print(json.dumps({"error": "笔记不存在"}))
        sys.exit(1)

    note = items[0].get('note_card', {})
    if not note:
        print(json.dumps({"error": "笔记不存在"}))
        sys.exit(1)

    images = []
    for img in note.get('image_list', []):
        url = img.get('url_default') or img.get('url') or ''
        if not url and img.get('info_list'):
            url = img['info_list'][0].get('url', '')
        if url:
            images.append(url)

    tags = [tag.get('name', '') for tag in note.get('tag_list', []) if tag.get('name')]

    detail = {
        "title": note.get('title', '') or note.get('display_title', ''),
        "content": note.get('desc', ''),
        "author": note.get('user', {}).get('nickname', ''),
        "images": images,
        "tags": tags,
        "likeCount": note.get('interact_info', {}).get('liked_count', 0),
        "collectCount": note.get('interact_info', {}).get('collected_count', 0),
        "commentCount": note.get('interact_info', {}).get('comment_count', 0),
    }

    print(json.dumps({"success": True, "detail": detail}))

except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
    sys.exit(1)
`;

      const pyProcess = spawn(config.pythonExecutable, [
        '-c', pythonScript, cookie, noteId, xsecToken
      ], {
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
          if (result.error) {
            reject(new Error(result.error));
            return;
          }

          const d = result.detail;
          resolve({
            title: d.title,
            content: d.content,
            author: d.author,
            url: `https://www.xiaohongshu.com/explore/${noteId}`,
            extra: {
              noteId,
              images: d.images,
              tags: d.tags,
              likeCount: d.likeCount,
              collectCount: d.collectCount,
              commentCount: d.commentCount,
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

export const xiaohongshuAdapter = new XiaohongshuAdapter();
