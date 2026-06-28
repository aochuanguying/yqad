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
   * 使用 Python xhshow 库
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
    
    # 随机休眠 1-5 秒，模拟人工操作
    sleep_time = random.uniform(1, 5)
    time.sleep(sleep_time)
    
    # Cookie 处理
    cookie = cookie.strip()
    cookie_dict = {}
    for item in cookie.split(';'):
        if '=' in item:
            key, value = item.split('=', 1)
            cookie_dict[key.strip()] = value.strip()
    
    a1_value = cookie_dict.get('a1')
    if not a1_value:
        print(json.dumps({"error": "无法从 Cookie 中提取 a1 值"}))
        sys.exit(1)
    
    # 初始化 xhshow 客户端
    client = Xhshow()
    search_id = client.get_search_id()
    
    # API 参数
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    uri = "/api/sns/web/v2/search/notes"
    
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
    
    headers = {
        "x-s": signature,
        "x-t": str(int(time.time() * 1000)),
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "content-type": "application/json;charset=UTF-8",
    }
    
    # 发送请求
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
    
    for item in items:
        try:
            note_data = item.get('note_card', {}) or item.get('model', {})
            note_id = item.get('id', '')
            
            note = {
                'id': note_id,
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
                    'url': note_data.get('cover', {}).get('url', '') or ''
                },
                'type': note_data.get('type', 'normal'),
                'url': f"https://www.xiaohongshu.com/explore/{note_id}" if note_id else ''
            }
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
   * 获取小红书笔记详情（使用 Playwright 访问详情页）
   * @param noteId 笔记 ID
   * @param xsecToken 可选的 xsec_token（用于访问受限笔记）
   * @returns 笔记详情
   */
  async getNoteDetail(noteId: string, xsecToken?: string): Promise<{
    success: boolean;
    data?: {
      id: string;
      title: string;
      content: string;
      author: string;
      likes: number;
      collects: number;
      comments: number;
      images: string[];
      url: string;
    };
    error?: string;
  }> {
    try {
      logger.info(`开始获取笔记详情：${noteId}`);
      
      const result = await this.getDetailViaPlaywright(noteId, xsecToken);
      
      if (result.success && result.data) {
        logger.info(`笔记详情获取成功：${result.data.title}`);
        return {
          success: true,
          data: {
            id: result.data.id,
            title: result.data.title || '无标题',
            content: result.data.desc || '',
            author: result.data.user?.nickname || '未知用户',
            likes: parseInt(result.data.interact_info?.liked_count) || 0,
            collects: parseInt(result.data.interact_info?.collected_count) || 0,
            comments: parseInt(result.data.interact_info?.comment_count) || 0,
            images: result.data.images || [],
            url: result.data.url || `https://www.xiaohongshu.com/explore/${noteId}`,
          },
        };
      } else {
        return {
          success: false,
          error: result.error || '获取详情失败',
        };
      }
    } catch (error) {
      logger.error('获取笔记详情失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取详情失败',
      };
    }
  }

  /**
   * 使用 Playwright 获取笔记详情（Python 脚本）
   */
  private async getDetailViaPlaywright(noteId: string, xsecToken?: string): Promise<{
    success: boolean;
    data?: {
      id: string;
      title: string;
      desc: string;
      user: { nickname: string };
      interact_info: {
        liked_count: string;
        collected_count: string;
        comment_count: string;
      };
      images: string[];
      url: string;
    };
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      const pythonScript = `
import json
import sys
import time
import random
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
import requests
from xhshow import Xhshow

def get_note_detail_from_page(note_id, xsec_token, cookie):
    """使用 Playwright 访问详情页，提取完整内容"""
    playwright = None
    browser = None
    try:
        # 构建 URL
        url = f"https://www.xiaohongshu.com/explore/{note_id}"
        if xsec_token:
            url += f"?xsec_token={xsec_token}"
        
        # 启动浏览器
        playwright = sync_playwright().start()
        
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        )
        
        # Cookie 处理
        cookie = re.sub(r'[\\r\\n\\t]+', ' ', cookie.strip())
        cookie = re.sub(r'\\s+', ' ', cookie).strip()
        
        cookie_dict = {}
        for item in cookie.split(';'):
            if '=' in item:
                key, value = item.split('=', 1)
                cookie_dict[key.strip()] = value.strip()
        
        # 创建浏览器上下文
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
        )
        
        # 设置 Cookie
        cookies = []
        for key, value in cookie_dict.items():
            cookies.append({
                'name': key,
                'value': value,
                'domain': '.xiaohongshu.com',
                'path': '/',
            })
        
        if cookies:
            context.add_cookies(cookies)
        
        page = context.new_page()
        
        # 注入 stealth.js (如果存在)
        import os
        stealth_path = Path(os.getcwd()) / 'stealth.min.js'
        if stealth_path.exists():
            stealth_content = stealth_path.read_text(encoding='utf-8')
            page.add_init_script(stealth_content)
        
        # 访问页面
        page.goto(url, wait_until='networkidle', timeout=30000)
        
        # 等待页面加载
        time.sleep(3)
        
        # 检查是否显示"笔记暂时无法浏览"
        try:
            error_element = page.query_selector('text=笔记暂时无法浏览')
            if error_element:
                browser.close()
                return {'success': False, 'error': '笔记暂时无法浏览'}
        except:
            pass
        
        # 使用 JavaScript 提取内容
        note_data = page.evaluate('''() => {
            const data = {
                title: '',
                desc: '',
                user: '',
                likes: '',
                collects: '',
                comments: '',
                images: []
            };
            
            // 提取标题
            const titleEl = document.querySelector('.title') || 
                           document.querySelector('[class*="title"]') ||
                           document.querySelector('h1');
            if (titleEl) {
                data.title = titleEl.textContent.trim();
            }
            
            // 提取描述/内容
            const descEl = document.querySelector('.desc') || 
                          document.querySelector('[class*="desc"]') ||
                          document.querySelector('[class*="content"]') ||
                          document.querySelector('article');
            if (descEl) {
                data.desc = descEl.textContent.trim();
            }
            
            // 提取用户信息
            const userEl = document.querySelector('.user-name') ||
                          document.querySelector('[class*="user"]') ||
                          document.querySelector('[class*="author"]');
            if (userEl) {
                data.user = userEl.textContent.trim();
            }
            
            // 提��互动数据
            const likeEl = document.querySelector('[class*="like"] span') ||
                          document.querySelector('[class*="interact"] span');
            if (likeEl) {
                data.likes = likeEl.textContent.trim();
            }
            
            const collectEl = document.querySelector('[class*="collect"] span');
            if (collectEl) {
                data.collects = collectEl.textContent.trim();
            }
            
            const commentEl = document.querySelector('[class*="comment"] span');
            if (commentEl) {
                data.comments = commentEl.textContent.trim();
            }
            
            // 提取图片
            const imgEls = document.querySelectorAll('img[src]');
            data.images = Array.from(imgEls)
                .map(img => img.src)
                .filter(src => src && src.startsWith('http'))
                .slice(0, 10);
            
            return data;
        }''')
        
        browser.close()
        
        if not note_data.get('title') and not note_data.get('desc'):
            return {'success': False, 'error': '无法从页面提取内容'}
        
        return {
            'success': True,
            'note_id': note_id,
            'data': {
                'id': note_id,
                'title': note_data.get('title', ''),
                'desc': note_data.get('desc', ''),
                'user': {'nickname': note_data.get('user', '')},
                'interact_info': {
                    'liked_count': str(note_data.get('likes', '0')),
                    'collected_count': str(note_data.get('collects', '0')),
                    'comment_count': str(note_data.get('comments', '0'))
                },
                'images': note_data.get('images', []),
                'url': f"https://www.xiaohongshu.com/explore/{note_id}"
            }
        }
        
    except Exception as e:
        if browser:
            try:
                browser.close()
            except:
                pass
        return {'success': False, 'error': f'Playwright 错误：{str(e)}'}

# 主逻辑
cookie = sys.argv[1]
note_id = sys.argv[2]
xsec_token = sys.argv[3] if len(sys.argv) > 3 else ''

result = get_note_detail_from_page(note_id, xsec_token, cookie)
print(json.dumps(result, ensure_ascii=False))
`;

      // 使用 Python 3.10+
      const pythonExecutable = process.env.PYTHON_EXECUTABLE || '/opt/homebrew/bin/python3.10';
      const args = [
        '-c',
        pythonScript,
        this.cookie,
        noteId,
        xsecToken || '',
      ];

      const pyProcess = spawn(pythonExecutable, args);

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
          
          if (result.error) {
            resolve({
              success: false,
              error: result.error,
            });
            return;
          }

          resolve(result);
        } catch (e) {
          reject(new Error(`解析响应失败：${output}`));
        }
      });

      // 设置超时（60 秒，因为 Playwright 需要加载页面）
      setTimeout(() => {
        pyProcess.kill();
        reject(new Error('获取详情超时（60 秒）'));
      }, 60000);
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
