import crypto from 'crypto';
import { BaseAdapter, SearchResult, ContentDetail, SearchOptions, AdapterError } from './base-adapter';
import { withRetry } from '../infra/retry';
import { checkRateLimit, randomDelay } from '../infra/rate-limiter';
import { cacheGet, cacheSet, buildCacheKey } from '../infra/cache';
import { getConfig } from '../config/default';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// WBI 签名混淆表（B站固定算法）
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

interface WbiKeys {
  imgKey: string;
  subKey: string;
}

export class BilibiliAdapter extends BaseAdapter {
  readonly platform = 'bilibili';

  private buvid3: string | null = null;
  private wbiKeys: WbiKeys | null = null;
  private wbiKeysExpireAt = 0;

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, maxResults = 10, summaryMode = false, noCache = false } = options;

    console.log(`[bilibili] 开始搜索：query="${query}", maxResults=${maxResults}`);

    // 缓存检查
    const cacheKey = buildCacheKey('bilibili', 'search', { query, maxResults });
    if (!noCache) {
      const cached = await cacheGet<SearchResult[]>(cacheKey);
      if (cached) {
        console.log('[bilibili] 缓存命中');
        return cached;
      }
    }

    // 频率控制
    const config = getConfig();
    const rateResult = await checkRateLimit('platform:bilibili', config.rateLimit.perPlatformPerMinute);
    if (!rateResult.allowed) {
      console.log(`[bilibili] 触发频率限制，等待 ${rateResult.retryAfter}s`);
      await new Promise(resolve => setTimeout(resolve, (rateResult.retryAfter || 5) * 1000));
    }

    await randomDelay();

    const results = await withRetry(async () => {
      return await this.searchVideo(query, maxResults);
    }, { maxRetries: 2 });

    const processed = results.map(r => ({
      ...r,
      snippet: this.truncateSnippet(r.snippet, summaryMode),
    }));

    await cacheSet(cacheKey, processed, config.cache.ttl);
    console.log(`[bilibili] 搜索完成，返回 ${processed.length} 条结果`);
    return processed;
  }

  async getContent(params: Record<string, string>): Promise<ContentDetail | AdapterError> {
    const bvid = params.bvid || this.extractBvid(params.url || '');
    if (!bvid) {
      return { error: 'INVALID_PARAMS', message: '缺少 bvid 参数（或无法从 url 解析出 BV 号）' };
    }

    try {
      const detail = await withRetry(async () => {
        return await this.fetchVideoDetail(bvid);
      }, { maxRetries: 2 });
      return detail;
    } catch (err: any) {
      if (err.message.includes('稿件不可见') || err.message.includes('不存在') || err.message.includes('-404')) {
        return { error: 'VIDEO_NOT_FOUND', message: '视频不存在或已被删除' };
      }
      return { error: 'FETCH_FAILED', message: err.message };
    }
  }

  /**
   * 视频搜索（带 WBI 签名）
   */
  private async searchVideo(query: string, maxResults: number): Promise<SearchResult[]> {
    const signedParams = await this.signParams({
      search_type: 'video',
      keyword: query,
      page: 1,
      page_size: Math.min(maxResults, 50),
    });

    const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${signedParams}`;
    const data = await this.request(url);

    if (data.code === -412) {
      throw new Error('B站请求被拦截（-412），buvid3 可能失效');
    }
    if (data.code !== 0) {
      throw new Error(`B站搜索接口错误: code=${data.code}, message=${data.message}`);
    }

    const items: any[] = data.data?.result || [];
    return items.slice(0, maxResults).map((item) => ({
      title: this.stripHtml(item.title || ''),
      snippet: item.description || '',
      author: item.author || '',
      url: item.bvid ? `https://www.bilibili.com/video/${item.bvid}` : (item.arcurl || ''),
      publishedAt: item.pubdate ? new Date(item.pubdate * 1000).toISOString() : undefined,
      extra: {
        bvid: item.bvid || '',
        aid: item.aid || 0,
        duration: item.duration || '',
        play: item.play || 0,
        danmaku: item.video_review || 0,
        like: item.like || 0,
        cover: item.pic ? (item.pic.startsWith('http') ? item.pic : `https:${item.pic}`) : '',
      },
    })).filter((r: SearchResult) => r.title);
  }

  /**
   * 视频详情（简介 + 基本信息）
   */
  private async fetchVideoDetail(bvid: string): Promise<ContentDetail> {
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
    const data = await this.request(url);

    if (data.code !== 0) {
      throw new Error(`B站视频详情错误: code=${data.code}, message=${data.message}`);
    }

    const d = data.data;
    return {
      title: d.title || '',
      content: d.desc || '',
      author: d.owner?.name || '',
      url: `https://www.bilibili.com/video/${d.bvid}`,
      publishedAt: d.pubdate ? new Date(d.pubdate * 1000).toISOString() : undefined,
      extra: {
        bvid: d.bvid || bvid,
        aid: d.aid || 0,
        duration: d.duration || 0,
        cover: d.pic || '',
        view: d.stat?.view || 0,
        danmaku: d.stat?.danmaku || 0,
        like: d.stat?.like || 0,
        coin: d.stat?.coin || 0,
        favorite: d.stat?.favorite || 0,
        share: d.stat?.share || 0,
        reply: d.stat?.reply || 0,
      },
    };
  }

  /**
   * 发起请求（自动带上 buvid3 cookie 和 UA）
   */
  private async request(url: string): Promise<any> {
    const buvid = await this.ensureBuvid3();
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': 'https://www.bilibili.com/',
        'Cookie': buvid ? `buvid3=${buvid}` : '',
      },
    });

    if (!response.ok) {
      throw new Error(`B站 API HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * 确保已获取 buvid3（无 cookie 会被 -412 拦截）
   */
  private async ensureBuvid3(): Promise<string> {
    if (this.buvid3) return this.buvid3;
    try {
      const response = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
        headers: { 'User-Agent': USER_AGENT, 'Referer': 'https://www.bilibili.com/' },
      });
      const data: any = await response.json();
      this.buvid3 = data?.data?.b_3 || '';
    } catch (err: any) {
      console.warn('[bilibili] 获取 buvid3 失败:', err.message);
      this.buvid3 = '';
    }
    return this.buvid3 || '';
  }

  /**
   * 获取 WBI 签名密钥（缓存 30 分钟）
   */
  private async getWbiKeys(): Promise<WbiKeys> {
    const now = Date.now();
    if (this.wbiKeys && now < this.wbiKeysExpireAt) {
      return this.wbiKeys;
    }

    const buvid = await this.ensureBuvid3();
    const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': 'https://www.bilibili.com/',
        'Cookie': buvid ? `buvid3=${buvid}` : '',
      },
    });
    const data: any = await response.json();
    const imgUrl: string = data?.data?.wbi_img?.img_url || '';
    const subUrl: string = data?.data?.wbi_img?.sub_url || '';

    const imgKey = imgUrl.split('/').pop()?.split('.')[0] || '';
    const subKey = subUrl.split('/').pop()?.split('.')[0] || '';

    if (!imgKey || !subKey) {
      throw new Error('获取 WBI 签名密钥失败');
    }

    this.wbiKeys = { imgKey, subKey };
    this.wbiKeysExpireAt = now + 30 * 60 * 1000;
    return this.wbiKeys;
  }

  /**
   * 生成 mixin_key（img_key + sub_key 按混淆表重排取前 32 位）
   */
  private getMixinKey(imgKey: string, subKey: string): string {
    const raw = imgKey + subKey;
    let mixin = '';
    for (const i of MIXIN_KEY_ENC_TAB) {
      mixin += raw[i] || '';
    }
    return mixin.slice(0, 32);
  }

  /**
   * 对参数进行 WBI 签名，返回已排序 + 附带 wts/w_rid 的 query string
   */
  private async signParams(params: Record<string, string | number>): Promise<string> {
    const { imgKey, subKey } = await this.getWbiKeys();
    const mixinKey = this.getMixinKey(imgKey, subKey);

    const wts = Math.floor(Date.now() / 1000);
    const signParams: Record<string, string | number> = { ...params, wts };

    // 按 key 升序排序，过滤 value 中的 !'()* 特殊字符
    const query = Object.keys(signParams)
      .sort()
      .map((key) => {
        const value = String(signParams[key]).replace(/[!'()*]/g, '');
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join('&');

    const wRid = crypto.createHash('md5').update(query + mixinKey).digest('hex');
    return `${query}&w_rid=${wRid}`;
  }

  private extractBvid(url: string): string {
    const match = url.match(/BV[0-9A-Za-z]+/);
    return match ? match[0] : '';
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
  }
}

export const bilibiliAdapter = new BilibiliAdapter();
