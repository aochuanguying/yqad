#!/usr/bin/env python3
"""
修复汽车之家脚本的日志输出问题
将所有日志输出到 stderr，JSON 输出到 stdout
"""

import re

# 读取文件
with open('/Users/mac/Documents/workspace/krio/yqad/scripts/test_autohome.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 需要修改的行：所有在 if urls_to_fetch 块内的 print 语句
# 将 print(f"...") 改为 print(f"...", file=sys.stderr)

# 找到需要修改的区域（第 618-635 行）
lines = content.split('\n')
fixed_lines = []

for i, line in enumerate(lines):
    # 在第 618-635 行之间的 print 语句需要修改
    if 617 <= i+1 <= 635 and line.strip().startswith('print('):
        # 检查是否已经是 file=sys.stderr
        if 'file=sys.stderr' not in line:
            # 修改为输出到 stderr
            line = line.replace('print(f"', 'print(f"', 1)
            # 在右括号前添加 file=sys.stderr
            if line.strip().endswith(')'):
                line = line.rstrip(')') + ', file=sys.stderr)'
            elif line.strip().endswith('")'):
                line = line.rstrip('")') + '", file=sys.stderr)'
    fixed_lines.append(line)

# 写回文件
with open('/Users/mac/Documents/workspace/krio/yqad/scripts/test_autohome.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(fixed_lines))

print("✓ 已修复汽车之家脚本的日志输出问题")
print("  所有日志现在将输出到 stderr，JSON 输出到 stdout")
