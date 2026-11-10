// 管理页（单文件，无外部依赖）。注意：本字符串内的脚本不要使用反引号与 ${，避免与 TS 模板字符串冲突。
export const ADMIN_PAGE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>大模型网关 · 上游配置</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f5f6f8; color: #222; }
  header { background: #1f2d3d; color: #fff; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; }
  header h1 { font-size: 16px; margin: 0; }
  main { max-width: 1200px; margin: 20px auto; padding: 0 16px; }
  section { background: #fff; border-radius: 6px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
  h2 { font-size: 15px; margin: 0 0 12px; display: flex; justify-content: space-between; align-items: center; }
  .hint { color: #888; font-size: 12px; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #eee; vertical-align: top; }
  th { font-weight: 600; color: #555; font-size: 12px; white-space: nowrap; }
  input[type=text], input[type=password], input[type=number], select { width: 100%; padding: 5px 7px; border: 1px solid #ccd; border-radius: 4px; font: inherit; }
  input[readonly] { background: #f3f3f3; color: #666; }
  .secret small { display: block; color: #888; font-size: 11px; margin-top: 2px; }
  .secret label { font-size: 11px; color: #a33; }
  button { padding: 5px 12px; border: 1px solid #ccd; background: #fff; border-radius: 4px; cursor: pointer; font: inherit; }
  button.primary { background: #1677ff; border-color: #1677ff; color: #fff; }
  button.danger { color: #c33; border-color: #e3b3b3; }
  button:disabled { opacity: .5; cursor: default; }
  .bar { display: flex; gap: 8px; align-items: center; }
  #msg { padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; display: none; white-space: pre-wrap; }
  #msg.ok { display: block; background: #e8f7ee; color: #17663a; }
  #msg.err { display: block; background: #fdecec; color: #a12020; }
  #login { max-width: 360px; margin: 80px auto; }
  #login input { margin: 8px 0 12px; }
  .meta { color: #ccd; font-size: 12px; }
  .hidden { display: none !important; }
  #newKeyBox { margin-top: 10px; padding: 10px 12px; background: #fff8e6; border: 1px solid #f0d58c; border-radius: 4px; }
  #newKeyBox code { font-size: 14px; background: #fff; padding: 3px 6px; border: 1px solid #e6d29a; border-radius: 3px; word-break: break-all; }
  .muted { color: #999; }
  .tag-off { color: #a33; }
</style>
</head>
<body>
<header>
  <h1>大模型网关 · 上游配置</h1>
  <div class="bar"><span class="meta" id="meta"></span><button id="logoutBtn" class="hidden">退出</button></div>
</header>

<section id="login" class="hidden">
  <h2>管理员登录</h2>
  <form id="loginForm">
    <input type="password" id="pwd" placeholder="管理员密码" autocomplete="current-password" required>
    <button class="primary" type="submit">登录</button>
  </form>
  <div id="loginErr" style="color:#a12020;margin-top:8px"></div>
</section>

<main id="app" class="hidden">
  <div id="msg"></div>

  <section>
    <h2>网关 API Key <span class="hint">调用方以 Authorization: Bearer &lt;Key&gt; 调用网关，校验通过才转发上游。增删、停用立即生效。</span></h2>
    <table>
      <thead><tr>
        <th style="width:22%">名称</th><th style="width:16%">Key</th><th style="width:8%">状态</th>
        <th style="width:16%">创建时间</th><th style="width:16%">最近使用</th><th style="width:8%">调用次数</th><th style="width:14%"></th>
      </tr></thead>
      <tbody id="keyBody"></tbody>
    </table>
    <div class="bar" style="margin-top:8px">
      <input type="text" id="newKeyName" placeholder="新 Key 名称，如 财务机器人" style="width:260px">
      <button id="addKey">+ 生成新 Key</button>
      <span class="hint">更换 Key：先生成新 Key 发给调用方，确认“最近使用”只剩新 Key 后再停用旧 Key。最近使用 / 调用次数自网关启动起统计。</span>
    </div>
    <div id="newKeyBox" class="hidden">
      <div>新 Key（<b>只显示这一次</b>，关闭或刷新页面后无法再查看，请立即复制保存）：</div>
      <div class="bar" style="margin-top:6px"><code id="newKeyValue"></code><button id="copyKey">复制</button><button id="closeKey">我已保存</button></div>
    </div>
  </section>

  <section>
    <h2>上游（大模型服务） <span class="hint">user_key 以 URL 参数 ?user_key= 传递；API Key 以 Authorization: Bearer 传递。密钥留空表示不修改。</span></h2>
    <table>
      <thead><tr>
        <th style="width:9%">ID</th><th style="width:10%">名称</th><th style="width:22%">地址 (baseUrl)</th>
        <th style="width:15%">user_key</th><th style="width:15%">API Key</th><th style="width:12%">代理(可选)</th>
        <th style="width:7%">超时ms</th><th style="width:4%">启用</th><th style="width:6%"></th>
      </tr></thead>
      <tbody id="upBody"></tbody>
    </table>
    <div style="margin-top:8px"><button id="addUp">+ 新增上游</button></div>
  </section>

  <section>
    <h2>模型路由 <span class="hint">客户端传的 model → 指定上游的实际模型。</span></h2>
    <table>
      <thead><tr>
        <th style="width:24%">模型名（客户端传）</th><th style="width:20%">上游</th><th style="width:28%">上游实际模型</th>
        <th style="width:10%">默认思考</th><th style="width:8%">启用</th><th style="width:8%"></th>
      </tr></thead>
      <tbody id="mBody"></tbody>
    </table>
    <div style="margin-top:8px"><button id="addM">+ 新增模型</button></div>
    <p class="hint" style="margin:10px 0 0">
      默认思考：调用方未指定 <code>chat_template_kwargs.enable_thinking</code> 时，网关按此设置发送 <code>enable_thinking=true/false</code>；调用方自己传了则以调用方为准。响应（含 reasoning_content）原样返回。
    </p>
  </section>

  <section class="bar">
    <button class="primary" id="saveBtn">保存并立即生效</button>
    <button id="discardBtn">放弃修改</button>
    <button id="reloadBtn" title="手工编辑 upstreams.json 后，从文件重新加载">从文件重新加载</button>
  </section>
</main>

<script>
(function () {
  var state = null;
  var $ = function (id) { return document.getElementById(id); };

  function api(method, url, body) {
    var opt = { method: method, headers: { 'X-Admin-Request': '1' }, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, data: j }; });
    });
  }

  function showMsg(text, ok) { var m = $('msg'); m.textContent = text; m.className = ok ? 'ok' : 'err'; window.scrollTo(0, 0); }
  function clearMsg() { $('msg').className = ''; $('msg').textContent = ''; }

  function showLogin() { $('login').classList.remove('hidden'); $('app').classList.add('hidden'); $('logoutBtn').classList.add('hidden'); $('meta').textContent = ''; }
  function showApp() { $('login').classList.add('hidden'); $('app').classList.remove('hidden'); $('logoutBtn').classList.remove('hidden'); }

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'checked' || k === 'readOnly' || k === 'value') e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function cell(child) { return el('td', {}, [child]); }

  function secretCell(cls, masked, has) {
    var input = el('input', { type: 'password', 'class': cls, placeholder: has ? '已设置，留空不修改' : '未设置', autocomplete: 'new-password' });
    var children = [input];
    if (has) {
      children.push(el('small', { text: '当前: ' + masked }));
      var cb = el('input', { type: 'checkbox', 'class': cls + '-clear' });
      children.push(el('label', {}, [cb, document.createTextNode(' 清空')]));
    }
    return el('td', { 'class': 'secret' }, children);
  }

  function upRow(u, isNew) {
    var tr = el('tr', { 'data-new': isNew ? '1' : '0' });
    tr.appendChild(cell(el('input', { type: 'text', 'class': 'f-id', value: u.id || '', readOnly: !isNew, placeholder: '如 higpt' })));
    tr.appendChild(cell(el('input', { type: 'text', 'class': 'f-name', value: u.name || '' })));
    tr.appendChild(cell(el('input', { type: 'text', 'class': 'f-baseUrl', value: u.baseUrl || '', placeholder: 'https://.../v1' })));
    tr.appendChild(secretCell('f-userKey', u.userKeyMasked, u.hasUserKey));
    tr.appendChild(secretCell('f-apiKey', u.apiKeyMasked, u.hasApiKey));
    tr.appendChild(cell(el('input', { type: 'text', 'class': 'f-proxyUrl', value: u.proxyUrl || '', placeholder: '留空=直连' })));
    tr.appendChild(cell(el('input', { type: 'number', 'class': 'f-timeoutMs', value: u.timeoutMs || 120000, min: 1 })));
    tr.appendChild(cell(el('input', { type: 'checkbox', 'class': 'f-enabled', checked: u.enabled !== false })));
    var del = el('button', { 'class': 'danger', text: '删除' });
    del.onclick = function () { tr.remove(); refreshUpstreamOptions(); };
    tr.appendChild(cell(del));
    tr.querySelector('.f-id').addEventListener('input', refreshUpstreamOptions);
    return tr;
  }

  function currentUpstreamIds() {
    return Array.prototype.map.call(document.querySelectorAll('#upBody .f-id'), function (i) { return i.value.trim(); }).filter(Boolean);
  }

  function fillSelect(sel, selected) {
    var ids = currentUpstreamIds();
    sel.innerHTML = '';
    if (selected && ids.indexOf(selected) < 0) ids.push(selected);
    ids.forEach(function (id) { sel.appendChild(el('option', { value: id, text: id })); });
    sel.value = selected || ids[0] || '';
  }

  function refreshUpstreamOptions() {
    document.querySelectorAll('#mBody .f-upstreamId').forEach(function (s) { fillSelect(s, s.value); });
  }

  function mRow(m) {
    var tr = el('tr');
    tr.appendChild(cell(el('input', { type: 'text', 'class': 'f-name', value: m.name || '', placeholder: '如 qwen' })));
    var sel = el('select', { 'class': 'f-upstreamId' });
    tr.appendChild(cell(sel));
    tr.appendChild(cell(el('input', { type: 'text', 'class': 'f-upstreamModel', value: m.upstreamModel || '', placeholder: '如 qwen3-5-397b' })));
    tr.appendChild(cell(el('input', { type: 'checkbox', 'class': 'f-thinking', checked: m.thinking === true })));
    tr.appendChild(cell(el('input', { type: 'checkbox', 'class': 'f-enabled', checked: m.enabled !== false })));
    var del = el('button', { 'class': 'danger', text: '删除' });
    del.onclick = function () { tr.remove(); };
    tr.appendChild(cell(del));
    $('mBody').appendChild(tr);
    fillSelect(sel, m.upstreamId);
    return tr;
  }

  function fmtTime(t) { return t ? new Date(t).toLocaleString() : ''; }

  function renderKeys(list) {
    var body = $('keyBody');
    body.innerHTML = '';
    list.forEach(function (k) {
      var tr = el('tr');
      tr.appendChild(cell(el('span', { text: k.name })));
      tr.appendChild(cell(el('code', { text: k.prefix + '…' })));
      tr.appendChild(cell(el('span', { text: k.enabled ? '启用' : '已停用', 'class': k.enabled ? '' : 'tag-off' })));
      tr.appendChild(cell(el('span', { text: fmtTime(k.createdAt) })));
      tr.appendChild(cell(el('span', { text: k.lastUsedAt ? fmtTime(k.lastUsedAt) : '未使用', 'class': k.lastUsedAt ? '' : 'muted' })));
      tr.appendChild(cell(el('span', { text: String(k.useCount) })));
      var toggle = el('button', { text: k.enabled ? '停用' : '启用' });
      toggle.onclick = function () {
        if (k.enabled && !confirm('停用后，使用 “' + k.name + '” 的调用方会立即收到 401。确定停用？')) return;
        keyOp('PATCH', 'api/keys/' + encodeURIComponent(k.id), { enabled: !k.enabled }, k.enabled ? '已停用' : '已启用');
      };
      var del = el('button', { 'class': 'danger', text: '删除' });
      del.onclick = function () {
        if (!confirm('删除 “' + k.name + '”？删除不可恢复，使用它的调用方会立即收到 401。')) return;
        keyOp('DELETE', 'api/keys/' + encodeURIComponent(k.id), undefined, '已删除');
      };
      var ops = el('td', {}, [toggle, document.createTextNode(' '), del]);
      tr.appendChild(ops);
      body.appendChild(tr);
    });
  }

  function keyOp(method, url, body, okText) {
    return api(method, url, body).then(function (r) {
      if (r.status === 200) { renderKeys(r.data.apiKeys); showMsg(okText + '，立即生效。', true); return r.data; }
      if (r.status === 401) { showLogin(); return null; }
      showMsg(r.data.error || ('操作失败: ' + r.status)); return null;
    });
  }

  function render(s) {
    state = s;
    renderKeys(s.apiKeys || []);
    $('upBody').innerHTML = '';
    $('mBody').innerHTML = '';
    s.upstreams.forEach(function (u) { $('upBody').appendChild(upRow(u, false)); });
    s.models.forEach(function (m) { mRow(m); });
    $('meta').textContent = '版本 ' + s.revision + ' · 更新于 ' + new Date(s.updatedAt).toLocaleString();
  }

  function collect() {
    var ups = Array.prototype.map.call(document.querySelectorAll('#upBody tr'), function (tr) {
      var q = function (c) { return tr.querySelector('.' + c); };
      var o = {
        id: q('f-id').value.trim(), name: q('f-name').value.trim(), baseUrl: q('f-baseUrl').value.trim(),
        userKey: q('f-userKey').value, apiKey: q('f-apiKey').value,
        proxyUrl: q('f-proxyUrl').value.trim(), timeoutMs: Number(q('f-timeoutMs').value), enabled: q('f-enabled').checked
      };
      if (q('f-userKey-clear') && q('f-userKey-clear').checked) o.clearUserKey = true;
      if (q('f-apiKey-clear') && q('f-apiKey-clear').checked) o.clearApiKey = true;
      return o;
    });
    var ms = Array.prototype.map.call(document.querySelectorAll('#mBody tr'), function (tr) {
      var q = function (c) { return tr.querySelector('.' + c); };
      return { name: q('f-name').value.trim(), upstreamId: q('f-upstreamId').value, upstreamModel: q('f-upstreamModel').value.trim(),
        thinking: q('f-thinking').checked, enabled: q('f-enabled').checked };
    });
    return { revision: state.revision, upstreams: ups, models: ms };
  }

  function load() {
    return api('GET', 'api/config').then(function (r) {
      if (r.status === 401) { showLogin(); return; }
      if (r.status !== 200) { showApp(); showMsg(r.data.error || ('加载失败: ' + r.status)); return; }
      showApp(); render(r.data);
    });
  }

  $('loginForm').onsubmit = function (ev) {
    ev.preventDefault();
    $('loginErr').textContent = '';
    api('POST', 'api/login', { password: $('pwd').value }).then(function (r) {
      if (r.status === 200) { $('pwd').value = ''; clearMsg(); load(); }
      else $('loginErr').textContent = r.data.error || ('登录失败: ' + r.status);
    });
  };

  $('addKey').onclick = function () {
    var name = $('newKeyName').value.trim();
    if (!name) { showMsg('请先填写新 Key 的名称'); return; }
    keyOp('POST', 'api/keys', { name: name }, '已生成新 Key').then(function (d) {
      if (!d) return;
      $('newKeyName').value = '';
      $('newKeyValue').textContent = d.key;
      $('newKeyBox').classList.remove('hidden');
    });
  };
  $('copyKey').onclick = function () {
    var v = $('newKeyValue').textContent;
    var done = function () { $('copyKey').textContent = '已复制'; setTimeout(function () { $('copyKey').textContent = '复制'; }, 1500); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(v).then(done);
    else { var r = document.createRange(); r.selectNodeContents($('newKeyValue')); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('copy'); done(); }
  };
  $('closeKey').onclick = function () { $('newKeyValue').textContent = ''; $('newKeyBox').classList.add('hidden'); };

  $('logoutBtn').onclick = function () { api('POST', 'api/logout').then(showLogin); };
  $('addUp').onclick = function () { $('upBody').appendChild(upRow({ enabled: true, timeoutMs: 120000 }, true)); refreshUpstreamOptions(); };
  $('addM').onclick = function () { mRow({ enabled: true, thinking: false }); };
  $('discardBtn').onclick = function () { clearMsg(); load(); };

  $('saveBtn').onclick = function () {
    if (!state) return;
    var btn = $('saveBtn'); btn.disabled = true;
    api('PUT', 'api/config', collect()).then(function (r) {
      btn.disabled = false;
      if (r.status === 200) { render(r.data); showMsg('已保存，版本 ' + r.data.revision + '，新请求立即使用新配置。', true); }
      else if (r.status === 401) showLogin();
      else showMsg(r.data.error || ('保存失败: ' + r.status));
    }, function (e) { btn.disabled = false; showMsg('保存失败: ' + e); });
  };

  $('reloadBtn').onclick = function () {
    if (!confirm('从磁盘 upstreams.json 重新加载？页面上未保存的修改会丢失。')) return;
    api('POST', 'api/reload').then(function (r) {
      if (r.status === 200) { render(r.data); showMsg('已从文件重新加载，版本 ' + r.data.revision, true); }
      else if (r.status === 401) showLogin();
      else showMsg(r.data.error || ('加载失败: ' + r.status));
    });
  };

  load();
})();
</script>
</body>
</html>
`;
