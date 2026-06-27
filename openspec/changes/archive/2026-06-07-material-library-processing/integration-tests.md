## 变更级集成测试（curl）

### 0. 启动服务

在项目根目录执行：

```bash
npm run dev
```

默认端口为 `config/default.yaml` 的 `web.port`（通常是 3000）。

### 1. 校验 /api/materials 默认消费处理后目录

执行两次，输出应保持一致（至少前 50 行一致）：

```bash
curl -s "http://localhost:3000/api/materials" \
  | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); (j.items||[]).slice(0,50).forEach(i=>console.log((i.directory||'')+'|'+i.filename));"
```

验收点：
- items 稳定排序：directory 升序，filename 升序（根目录 directory 为空排最前）
- 返回内容来自处理后目录（`materials.processedPath` 或兼容的 `materials.basePath`）

### 2. 手工触发素材梳理（增量）

```bash
curl -s -X POST "http://localhost:3000/api/materials/process" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.message); console.log('scanned='+j.scanned,'processed='+j.processed,'copied='+j.copied,'failed='+j.failed,'skipped='+j.skipped);"
```

验收点：
- 返回包含 scanned/processed/copied/failed/skipped 字段
- 重复执行时（无新增原始素材）应返回 processed+copied+failed 为 0

### 3. 查询梳理信息

先从素材列表中挑一个处理后相对路径（例如：`travel/a.jpg`），将 `<PATH>` 替换为该值：

```bash
curl -s "http://localhost:3000/api/materials/info/<PATH>" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(j.status); console.log(j.source && j.source.relativePath); console.log(j.output && j.output.relativePath);"
```

验收点：
- 200 时返回结构化信息（至少包含 source、status、processedAt，且 output 存在时包含相对路径与体积）
- 不存在的 `<PATH>` 返回 404

### 4. 安全性：拒绝路径穿越

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/materials/info/%2e%2e%2fsecret.txt"
```

验收点：
- 返回 400

