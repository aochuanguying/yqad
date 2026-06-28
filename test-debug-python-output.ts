#!/usr/bin/env node
/**
 * 调试 Python 脚本输出
 */

import { spawn } from 'child_process';

const COOKIE = "abRequestId=fffb756a-1325-5a41-aa2e-883c0984041b; ets=1782592511470; webBuild=6.25.2; xsecappid=xhs-pc-web; a1=19f0acb1e2e6vlotdfndx9084y8496i59sfl1mdl830000151769; webId=fd8ec6332fe1b52dbf005ce5d5ddaa47; gid=yji80SDJSij2yji80SDydM6fJdKh1l9fiIfCi1Yj8Y4vY1q84jK32y888y2yWKj8qYWYYd4S; x-rednote-datactry=CN; x-rednote-holderctry=CN; loadts=1782616049151; web_session=040069b6d9aed466dced3fd875384be657a154; id_token=VjEAAHHe9Wn/qOAncepZv4A4oa0/PQehwYagdRsj8/f571Huw1htoLezA2Fh59sWWP5KWIc1jxj7Z3x95J9aR9jLFu048ev/A/vZQ/XWOMQ66wtefhOOxJS4HCbmneK4ejGM8oux; websectiga=a9bdcaed0af874f3a1431e94fbea410e8f738542fbb02df1e8e30c29ef3d91ac; sec_poison_id=1b4054c5-cd68-45c3-ad90-fe2877e49068; acw_tc=0ad627c117826168548753737e38d5d58c1df1d653d5ccec7be991873dc906; unread={%22ub%22:%226a4058e8000000001603c259%22%2C%22ue%22:%226a33c0c40000000006032d84%22%2C%22uc%22:36}";

const pythonScript = `
import json
import sys
import time
import requests
from xhshow import Xhshow

cookie = sys.argv[1]
keyword = sys.argv[2]
max_results = int(sys.argv[3])

# 提取 a1
a1_value = None
for item in cookie.split(';'):
    if '=' in item:
        key, value = item.split('=', 1)
        if key.strip() == 'a1':
            a1_value = value.strip()
            break

if not a1_value:
    print(json.dumps({"error": "no a1"}))
    sys.exit(1)

client = Xhshow()
search_id = client.get_search_id()

url = "https://so.xiaohongshu.com/api/sns/web/v2/search/notes"
uri = "/api/sns/web/v2/search/notes"

payload = {
    "keyword": keyword,
    "page": 1,
    "page_size": max_results,
    "search_id": search_id,
    "sort": "general",
    "note_type": 0
}

signature = client.sign_xs_post(uri=uri, a1_value=a1_value, payload=payload)

headers = {
    "x-s": signature,
    "x-t": str(int(time.time() * 1000)),
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "content-type": "application/json;charset=UTF-8",
}

cookie_dict = {}
for item in cookie.split(';'):
    if '=' in item:
        key, value = item.split('=', 1)
        cookie_dict[key.strip()] = value.strip()

print(f"DEBUG: Sending request...", file=sys.stderr)
response = requests.post(url, headers=headers, json=payload, cookies=cookie_dict, timeout=30)
print(f"DEBUG: Status={response.status_code}", file=sys.stderr)

result = response.json()
print(f"DEBUG: success={result.get('success')}", file=sys.stderr)
print(f"DEBUG: items count={len(result.get('data', {}).get('items', []))}", file=sys.stderr)

items = result.get('data', {}).get('items', [])
print(f"DEBUG: First item keys={items[0].keys() if items else 'empty'}", file=sys.stderr)

notes = []
for item in items:
    note_card = item.get('note_card', {})
    note_id = item.get('id', '')
    title = note_card.get('display_title', '') if note_card else ''
    
    print(f"DEBUG: Processing item - id={note_id[:20] if note_id else 'None'}, title={title[:20] if title else 'None'}", file=sys.stderr)
    
    if note_id:
        notes.append({
            'id': note_id,
            'title': title,
            'url': f"https://www.xiaohongshu.com/explore/{note_id}"
        })

print(json.dumps({"success": True, "notes": notes, "total": len(notes)}))
`;

console.log('=== 调试 Python 输出 ===\n');

const pyProcess = spawn('/opt/homebrew/bin/python3.10', [
  '-c', 
  pythonScript, 
  COOKIE, 
  '美食', 
  '3'
]);

pyProcess.stdout.on('data', (data: Buffer) => {
  console.log('STDOUT:', data.toString());
});

pyProcess.stderr.on('data', (data: Buffer) => {
  console.log('STDERR:', data.toString());
});

pyProcess.on('close', (code: number) => {
  console.log(`\n退出码：${code}`);
});
