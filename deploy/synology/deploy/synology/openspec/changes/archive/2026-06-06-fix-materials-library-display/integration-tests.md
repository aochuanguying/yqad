## 变更级集成测试（curl）

### 0. 启动服务

在项目根目录执行：

```bash
npm run dev
```

默认端口为 `config/default.yaml` 的 `web.port`（通常是 3000）。

### 1. 校验 /api/materials 返回顺序稳定

执行两次，输出应保持一致（至少前 50 行一致）：

```bash
curl -s "http://localhost:3000/api/materials" \
  | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); (j.items||[]).slice(0,50).forEach(i=>console.log((i.directory||'')+'|'+i.filename));"
```

验收点：
- 根目录（directory 为空）应排在最前
- directory 升序
- 同一 directory 内 filename 升序

### 2. 校验筛选模式排序一致

将 `<DIR>` 替换为一个实际存在的目录（可先从 `directories` 列表中选取）：

```bash
curl -s "http://localhost:3000/api/materials?dir=<DIR>" \
  | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); (j.items||[]).slice(0,50).forEach(i=>console.log((i.directory||'')+'|'+i.filename));"
```

验收点：
- 返回 items 仍按 directory 升序、filename 升序
- 仅包含 `<DIR>` 及其子目录下的素材

### 3. Web UI 验收点（人工）

打开：

```text
http://localhost:3000/
```

验收点：
- 进入“素材库”Tab 后，“全部目录”模式下按目录分组展示（分组标题为目录名，根目录显示“根目录”）
- 切换目录下拉框到某个目录后，仅展示一个分组（分组名为所选目录）
- 点击“🔄 刷新”后，分组与顺序保持稳定（不出现目录与图片混排/刷新后顺序跳变）
