# 知乎搜索功能改进总结

## 改进背景

根据实际测试结果，发现以下问题需要改进：

1. **环境变量设置时机问题** - 模块加载时就固定了 `ZHIHU_ACCESS_SECRET` 的值
2. **Cookie 支持不足** - Playwright 需要 Cookie 绕过知乎安全验证
3. **Python 脚本输出解析问题** - 日志输出混入 JSON 导致解析失败
4. **超时时间不足** - Playwright 提取内容需要更多时间

## 核心改进

### 1. 动态环境变量读取

**修改前：**
```typescript
const ZHIHU_ACCESS_SECRET = process.env.ZHIHU_ACCESS_SECRET || '';
```

**修改后：**
```typescript
const getAccessSecret = () => process.env.ZHIHU_ACCESS_SECRET || '';
const getCookie = () => process.env.ZHIHU_COOKIE || '';
```

**优势：**
- 避免模块加载时固定值
- 支持运行时动态设置环境变量
- 便于测试和调试

### 2. Cookie 支持

**新增环境变量：**
- `ZHIHU_COOKIE` - 知乎 Cookie 字符串，用于 Playwright 绕过安全验证

**TypeScript 端修改：**
```typescript
// 传递 Cookie 到 Python 脚本
const cookie = getCookie();
const resultsWithContent = await this.fetchContentViaPython(searchResults, accessSecret, cookie);
```

**Python 端新增函数：**
```python
def parse_cookie_string(cookie_str):
    """解析 Cookie 字符串为 Playwright 格式"""
    cookies = []
    parts = cookie_str.split(';')
    for part in parts:
        if '=' in part:
            key, value = part.split('=', 1)
            if key.startswith('_') or key in ['z_c0', '__zse_ck']:
                cookies.append({
                    'name': key,
                    'value': value,
                    'domain': '.zhihu.com',
                    'path': '/'
                })
    return cookies
```

### 3. 改进 JSON 解析逻辑

**修改前：**
```typescript
const result = JSON.parse(output);
```

**修改后：**
```typescript
// 解析 JSON 输出（忽略日志行）
const lines = output.split('\n');
let jsonStr = '';
let jsonStart = -1;

// 找到最后一行 JSON（跳过日志输出）
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].trim().startsWith('{')) {
    jsonStart = i;
    break;
  }
}

if (jsonStart >= 0) {
  jsonStr = lines.slice(jsonStart).join('\n');
} else {
  jsonStr = output;
}

const result = JSON.parse(jsonStr);
```

**优势：**
- 忽略 Python 脚本的日志输出（如 ✓ stealth.min.js 注入成功）
- 提高解析成功率

### 4. 优化超时和错误处理

**超时时间调整：**
```typescript
// 从 60 秒增加到 90 秒
setTimeout(() => {
  pyProcess.kill();
  logger.warn('Python 脚本执行超时，使用 Fallback 结果');
  resolve(this.mapToSearchResult(searchResults));
}, 90000);
```

**错误日志优化：**
```typescript
if (code !== 0) {
  logger.warn(`Python 脚本退出码：${code}`);
  if (errorOutput) {
    logger.debug(`错误输出：${errorOutput}`);
  }
  resolve(this.mapToSearchResult(searchResults));
  return;
}
```

**新增图片统计：**
```typescript
// 统计图片数量
const totalImages = finalResults.reduce((sum, r) => sum + (r.imageUrls?.length || 0), 0);
logger.info(`共提取 ${totalImages} 张图片`);
```

## 使用方式

### 1. 配置 Access Secret 和 Cookie

**从数据库读取（推荐）：**
```typescript
const prodConfig = {
  host: '192.168.50.50',
  user: 'root',
  password: 'your_password',
  database: 'yqad_prod_db',
};

const [rows]: any = await connection.execute(
  'SELECT zhihu_access_secret, zhihu_enabled FROM network_post_config LIMIT 1'
);

process.env.ZHIHU_ACCESS_SECRET = rows[0].zhihu_access_secret;
process.env.ZHIHU_COOKIE = rows[0].zhihu_cookie; // 需要在数据库中添加此字段
```

**手动设置：**
```bash
export ZHIHU_ACCESS_SECRET="your_access_secret"
export ZHIHU_COOKIE="_xsrf=xxx; z_c0=xxx; __zse_ck=xxx"
```

### 2. 调用搜索

```typescript
import { ZhihuSearch } from './src/services/internet-search/zhihu-search';

const zhihu = new ZhihuSearch();
const results = await zhihu.search(['奥迪 Q5L'], 5);

console.log(`找到 ${results.length} 条结果`);
for (const result of results) {
  console.log(`标题：${result.title}`);
  console.log(`图片：${result.imageUrls?.length || 0} 张`);
}
```

## 测试结果

### 成功案例

```bash
$ npx tsx scripts/test-zhihu-complete-flow.ts

✅ 读取成功:
   - Access Secret: 11d78a6c28453c03f047552bc588d0...
   - 启用状态：是

✅ 搜索成功，找到 5 条结果

📋 帖子列表:
  1. 燃油 SUV 车主熬出头了！华为乾崑智驾加持，全新奥迪 Q5L 率先实现智能化 - 知乎
     URL: https://zhuanlan.zhihu.com/p/2031360576560046234
     内容长度：1092 字符
     图片数量：4 张 ✅

✅ 文本已保存到：scripts/output/20260630151355_.txt
✅ 图片已保存到：scripts/output/20260630151355__images/
```

### 提取到的图片

- 01_v2-317da4d68ebe1df64f36b29840641bcf_r.jpg (121K)
- 02_v2-44a1e7f9326e92b8b5af65d79e6f3cf1_r.jpg (108K)
- 03_v2-218f85330ca47c65ccc79e6997abba34_r.jpg (55K)
- 04_v2-6a4da481e802156e6d079e04dce339a1_r.jpg (57K)

## 待办事项

1. **数据库添加 Cookie 字段**
   ```sql
   ALTER TABLE network_post_config 
   ADD COLUMN zhihu_cookie TEXT COMMENT '知乎 Cookie（用于 Playwright）';
   ```

2. **自动刷新 Cookie 机制**
   - Cookie 会过期，需要定期更新
   - 可以添加自动刷新逻辑

3. **性能优化**
   - 当前并发数为 3，可根据实际情况调整
   - 考虑使用浏览器池提高并发性能

## 相关文件

- [`src/services/internet-search/zhihu-search.ts`](../src/services/internet-search/zhihu-search.ts) - 核心搜索服务
- [`scripts/test_zhihu_content.py`](../scripts/test_zhihu_content.py) - Python Playwright 脚本
- [`scripts/test-zhihu-complete-flow.ts`](../scripts/test-zhihu-complete-flow.ts) - 完整流程测试脚本

## 总结

通过以上改进，知乎搜索功能现在能够：

✅ 正确读取 Access Secret（从数据库或环境变量）  
✅ 使用 Cookie 绕过安全验证  
✅ 稳定提取正文内容（包括图片）  
✅ 正确处理日志输出和 JSON 解析  
✅ 提供更详细的错误日志和统计信息  

测试证明，改进后的方案可以成功提取知乎帖子的图文详情，满足业务需求。
