import { getLogger } from '../../utils/logger';
import { SearchResult, ISearchPlatform } from './platform-base';
import { spawn } from 'child_process';
import { loadConfig } from '../../utils/config';

const logger = getLogger('xiaohongshu-search');

// 从环境变量或配置获取 Cookie
const config = loadConfig();
const XIAOHONGSHU_COOKIE = process.env.XIAOHONGSHU_COOKIE || config.internetSearch?.xiaohongshuCookie || '';

/**
 * 小红书搜索结果
 */
interface XiaohongshuNote {
  id: string;
  title: string;
  desc: string;
  user: {
    nickname: string;
    avatar: string;
    user_id: string;
  };
  interact_info: {
    liked_count: string;
    collected_count: string;
    comment_count: string;
  };
  note_card: {
    type: string;
    display_title: string;
  };
  cover: {
    url: string;
  };
  url: string;
}

/**
 * 小红书搜索服务类
 * 
 * 使用 xhshow Python 库（最新的 mns0301 签名算法）访问小红书 Web API
 * 支持搜索笔记、获取笔记详情等功能
 * 
 * 技术细节：
 * - 使用 xhshow 生成 XYS_ 格式的签名
 * - 搜索 API: POST https://so.xiaohongshu.com/api/sns/web/v2/search/notes
 * - 强制随机休眠 1-10 秒，模拟人工操作
 * - 单次请求后自动结束，避免高频并发
 */
export class XiaohongshuSearch implements ISearchPlatform {
  private cookie: string;

  constructor() {
    this.cookie = XIAOHONGSHU_COOKIE;
  }

  getPlatformName(): string {
    return 'xiaohongshu';
  }

  getPlatformDisplayName(): string {
    return '小红书';
  }

  /**
   * 搜索小红书笔记
   * @param keywords 搜索关键词数组
   * @param maxResults 最大结果数量
   * @returns 搜索结果数组
   */
  async search(keywords: string[], maxResults: number): Promise<SearchResult[]> {
    try {
      const keyword = keywords.join(' ');
      logger.info(`开始搜索小红书："${keyword}"`);

      const results = await this.searchViaPython(keyword, maxResults);
      logger.info(`小红书搜索完成，返回 ${results.length} 条结果`);
      
      return results;
    } catch (error) {
      logger.error('小红书搜索失败', error);
      return [];
    }
  }

  /**
   * 使用 Python xhshow 库进行搜索（使用最新的 mns0301 签名算法）
   */
  private async searchViaPython(keyword: string, maxResults: number): Promise<SearchResult[]> {
    return new Promise((resolve, reject) => {
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
    
    # 随机休眠 1-10 秒，模拟人工操作
    sleep_time = random.uniform(1, 10)
    time.sleep(sleep_time)
    
    # 从 Cookie 中提取 a1 值
    a1_value = None
    for item in cookie.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            if key.strip() == 'a1':
                a1_value = value.strip()
                break
    
    if not a1_value:
        print(json.dumps({"error": "无法从 Cookie 中提取 a1 值"}))
        sys.exit(1)
    
    # 初始化 xhshow 客户端
    client = Xhshow()
    
    # 生成 search_id
    search_id = client.get_search_id()
    
    # API 参数
    # 注意：page_size 必须 >= 10，否则 API 返回空结果
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    uri = "/api/sns/web/v2/search/notes"
    
    # page_size 必须 >= 10，先请求足够多的结果，然后取前 max_results 条
    actual_page_size = max(max_results, 10)
    
    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": actual_page_size,
        "search_id": search_id,
        "sort": "general",
        "note_type": 0
    }
    
    # 生成签名
    signature = client.sign_xs_post(
        uri=uri,
        a1_value=a1_value,
        payload=payload
    )
    
    # 构建 headers（使用与 xiaohongshu_final.py 相同的配置）
    headers = {
        "x-s": signature,
        "x-t": str(int(time.time() * 1000)),
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "content-type": "application/json;charset=UTF-8",
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "zh-CN,zh;q=0.9",
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
        "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
    }
    
    # 将 Cookie 转换为字典
    cookie_dict = {}
    for item in cookie.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()
    
    # 发送请求
    response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
    
    if response.status_code != 200:
        print(json.dumps({"error": f"HTTP 错误：{response.status_code}"}))
        sys.exit(1)
    
    result = response.json()
    
    if not result.get('success'):
        error_msg = result.get('msg', '请求失败')
        print(json.dumps({"error": error_msg}))
        sys.exit(1)
    
    items = result.get('data', {}).get('items', [])
    notes = []
    
    for item in items:
        try:
            note_data = item.get('note_card', {}) or item.get('model', {})
            
            note = {
                'id': item.get('id', ''),
                'title': note_data.get('display_title', '') or note_data.get('title', '') or '',
                'desc': note_data.get('desc', '') or '',
                'user': {
                    'nickname': note_data.get('user', {}).get('nickname', '') or '',
                    'avatar': note_data.get('user', {}).get('avatar', '') or '',
                    'user_id': note_data.get('user', {}).get('user_id', '') or ''
                },
                'interact_info': {
                    'liked_count': str(note_data.get('interact_info', {}).get('liked_count', 0)),
                    'collected_count': str(note_data.get('interact_info', {}).get('collected_count', 0)),
                    'comment_count': str(note_data.get('interact_info', {}).get('comment_count', 0))
                },
                'cover': {
                    'url': note_data.get('cover', {}).get('url', '') or note_data.get('image_list', [{}])[0].get('url', '') if note_data.get('image_list') else ''
                },
                'type': note_data.get('type', 'normal')
            }
            
            note_id = note['id']
            if note_id:
                note['url'] = f"https://www.xiaohongshu.com/explore/{note_id}"
            else:
                note['url'] = ''
            
            notes.append(note)
        except Exception as e:
            continue
    
    print(json.dumps({"success": True, "notes": notes, "total": len(notes)}))
    
except Exception as e:
    import traceback
    print(json.dumps({"error": str(e), "traceback": traceback.format_exc()}))
    sys.exit(1)
`;

      // 使用 Python 3.10+ (xhshow 需要)
      const pythonExecutable = process.env.PYTHON_EXECUTABLE || '/opt/homebrew/bin/python3.10';
      const pyProcess = spawn(pythonExecutable, [
        '-c', 
        pythonScript, 
        this.cookie, 
        keyword, 
        maxResults.toString()
      ]);

      let output = '';
      let errorOutput = '';

      pyProcess.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      pyProcess.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
        logger.warn('Python stderr:', data.toString());
      });

      pyProcess.on('close', (code: number) => {
        logger.debug('Python 输出:', output);
        logger.debug('Python 错误输出:', errorOutput);
        logger.debug('Python 退出码:', code);
        
        if (code !== 0) {
          reject(new Error(errorOutput || `Python 进程退出码：${code}`));
          return;
        }

        try {
          const result = JSON.parse(output);
          logger.debug('解析结果:', JSON.stringify(result, null, 2).substring(0, 500));
          
          if (result.error) {
            reject(new Error(result.error));
            return;
          }

          const notes: XiaohongshuNote[] = result.notes || [];
          logger.debug('笔记数量:', notes.length);
          
          const searchResults: SearchResult[] = notes.map(note => ({
            title: note.title || '无标题',
            content: note.desc || '',
            source: '小红书',
            url: note.url || `https://www.xiaohongshu.com/explore/${note.id}`,
            author: note.user?.nickname || '未知用户',
            likes: parseInt(note.interact_info?.liked_count) || 0,
            comments: parseInt(note.interact_info?.comment_count) || 0,
            collects: parseInt(note.interact_info?.collected_count) || 0,
            coverImage: note.cover?.url || undefined,
            publishTime: undefined,
          }));

          resolve(searchResults);
        } catch (e) {
          reject(new Error(`解析响应失败：${output}`));
        }
      });

      // 设置超时
      setTimeout(() => {
        pyProcess.kill();
        reject(new Error('搜索超时（30 秒）'));
      }, 30000);
    });
  }

  /**
   * 测试连接是否有效
   */
  async testConnection(): Promise<{ success: boolean; resultCount?: number; error?: string }> {
    try {
      const results = await this.search(['测试'], 5);
      return {
        success: true,
        resultCount: results.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '连接失败',
      };
    }
  }
}
