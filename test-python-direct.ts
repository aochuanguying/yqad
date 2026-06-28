#!/usr/bin/env node
/**
 * 直接测试 Python 脚本输出
 */

import { spawn } from 'child_process';

const COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}";

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
    
    # 随机休眠 1-3 秒
    sleep_time = random.uniform(1, 3)
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
    url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
    uri = "/api/sns/web/v2/search/notes"
    
    payload = {
        "keyword": keyword,
        "page": 1,
        "page_size": min(max_results, 20),
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
    
    # 构建 headers
    headers = {
        "x-s": signature,
        "x-t": str(int(time.time() * 1000)),
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        "content-type": "application/json;charset=UTF-8",
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
            note_card = item.get('note_card', {}) or item.get('model', {})
            
            note = {
                'id': item.get('id', ''),
                'title': note_card.get('display_title', '') or note_card.get('title', '') or '',
                'desc': note_card.get('desc', '') or '',
                'user': {
                    'nickname': note_card.get('user', {}).get('nickname', '') or '',
                    'avatar': note_card.get('user', {}).get('avatar', '') or '',
                    'user_id': note_card.get('user', {}).get('user_id', '') or ''
                },
                'interact_info': {
                    'liked_count': str(note_card.get('interact_info', {}).get('liked_count', 0)),
                    'collected_count': str(note_card.get('interact_info', {}).get('collected_count', 0)),
                    'comment_count': str(note_card.get('interact_info', {}).get('comment_count', 0))
                },
                'cover': {
                    'url': note_card.get('cover', {}).get('url', '') or note_card.get('image_list', [{}])[0].get('url', '') if note_card.get('image_list') else ''
                },
                'type': note_card.get('type', 'normal')
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

console.log('=== 直接测试 Python 脚本 ===\n');

const pyProcess = spawn('/opt/homebrew/bin/python3.10', [
  '-c', 
  pythonScript, 
  COOKIE, 
  '美食', 
  '3'
]);

let output = '';
let errorOutput = '';

pyProcess.stdout.on('data', (data: Buffer) => {
  output += data.toString();
  console.log('STDOUT:', data.toString());
});

pyProcess.stderr.on('data', (data: Buffer) => {
  errorOutput += data.toString();
  console.log('STDERR:', data.toString());
});

pyProcess.on('close', (code: number) => {
  console.log(`\n退出码：${code}`);
  console.log(`输出长度：${output.length}`);
  console.log(`错误输出长度：${errorOutput.length}`);
  
  if (code === 0 && output.length > 0) {
    try {
      const result = JSON.parse(output);
      console.log('\n解析成功！');
      console.log('Success:', result.success);
      console.log('Total:', result.total);
      if (result.notes && result.notes.length > 0) {
        console.log('\n前 3 条笔记:');
        result.notes.forEach((note: any, i: number) => {
          console.log(`${i + 1}. ${note.title}`);
        });
      }
    } catch (e) {
      console.log('解析失败:', e);
      console.log('原始输出:', output.substring(0, 500));
    }
  } else {
    console.log('失败:', errorOutput || `退出码：${code}`);
  }
});
