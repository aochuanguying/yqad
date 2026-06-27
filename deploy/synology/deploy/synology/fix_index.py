#!/usr/bin/env python3
# -*- coding: utf-8 -*-

file_path = '/Users/mac/Library/CloudStorage/SynologyDrive-我的云盘/000 Workspace/yqad/dist/web/public/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 查找旧的 loadConfig 函数
old_code = """    // 加载配置
    async function loadConfig() {
      try {
        const resp = await fetch('/api/config');
        configData = await resp.json();
        document.getElementById('status-text').textContent = '已连接';
      } catch (e) {
        document.getElementById('status-text').textContent = '连接失败';
        showToast('无法加载配置：' + e.message, 'error');
      }
    }"""

# 新的 loadConfig 函数
new_code = """    // 加载配置
    async function loadConfig() {
      try {
        const resp = await fetch('/api/config');
        if (!resp.ok) {
          if (resp.status === 401) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
            return;
          }
          throw new Error(`HTTP ${resp.status}`);
        }
        configData = await resp.json();
        document.getElementById('status-text').textContent = '已连接';
      } catch (e) {
        document.getElementById('status-text').textContent = '连接失败';
        showToast('无法加载配置：' + e.message, 'error');
      }
    }"""

# 替换
if old_code in content:
    content = content.replace(old_code, new_code)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('✅ 文件修改成功')
else:
    print('❌ 未找到目标代码')
