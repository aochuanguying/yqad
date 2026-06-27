#!/usr/bin/env python3
"""解析飞书导出的 HTML 文档，提取正文内容并生成 Markdown。"""

import re
import sys
from urllib.parse import unquote


def extract_content(html_file):
    """从飞书 HTML 文件中提取正文内容。"""
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 找到 page-block-children 区域
    start_marker = '<div class="page-block-children">'
    start_pos = content.find(start_marker)
    if start_pos == -1:
        print("错误：未找到 page-block-children 区域")
        return None

    # 找到对应的结束位置（匹配 div 深度）
    pos = start_pos
    depth = 0
    end_pos = -1
    i = pos
    while i < len(content):
        if content[i:i+5] == '<div ' or content[i:i+5] == '<div>':
            depth += 1
        elif content[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                end_pos = i + 6
                break
        i += 1

    if end_pos == -1:
        print("错误：无法找到 page-block-children 结束位置")
        return None

    body_html = content[pos:end_pos]

    # 找到 render-unit-wrapper 内的所有顶层 block
    # 这些 block 的 data-block-type 在 render-unit-wrapper 的直接子级中
    # 策略：找到所有 data-block-type 的 div，但排除嵌套在 table_cell 内的

    # 先找到所有顶层 block（不在 table 内部的）
    all_blocks = []
    for m in re.finditer(
            r'<div class="block (docx-(\w+)-block)[^"]*" data-block-type="\2"[^>]*>',
            body_html):
        start = m.start()
        block_type = m.group(2)
        all_blocks.append((start, block_type))

    # 找到所有 table 的范围
    table_ranges = []
    for m in re.finditer(
            r'<div class="block docx-table-block"[^>]*data-block-type="table"[^>]*>',
            body_html):
        t_start = m.start()
        # 找到这个 table block 的结束位置
        depth = 1
        i = t_start + len(m.group(0))
        while i < len(body_html) and depth > 0:
            if body_html[i:i+5] == '<div ' or body_html[i:i+5] == '<div>':
                depth += 1
            elif body_html[i:i+6] == '</div>':
                depth -= 1
            i += 1
        t_end = i
        table_ranges.append((t_start, t_end))

    # 过滤掉在 table 内部的 block
    def is_inside_table(pos):
        for ts, te in table_ranges:
            if ts < pos < te:
                return True
        return False

    top_blocks = [(s, bt) for s, bt in all_blocks if not is_inside_table(s)]

    blocks = []
    for idx, (start, block_type) in enumerate(top_blocks):
        if idx + 1 < len(top_blocks):
            end = top_blocks[idx + 1][0]
        else:
            end = len(body_html)
        block_html = body_html[start:end]
        blocks.append((block_type, block_html))

    return blocks


def extract_inline_text(html):
    """提取内联文本，处理粗体、代码、链接等。"""
    # 移除 data-enter 等标记
    html = re.sub(r'<span[^>]*data-enter="true"[^>]*>.*?</span>', '', html)
    # 移除 zero-space
    html = re.sub(r'<span[^>]*data-zero-space="true"[^>]*>.*?</span>', '', html)

    # 处理链接（在 inline-code 之前）
    # 飞书链接格式: <a href="..."><span>text</span></a> 或拆成多个 <a>
    def replace_link(m):
        href = m.group(1)   # href 属性值
        inner = m.group(2)  # 链接内部 HTML
        # 提取链接文本（去除内部所有 HTML 标签）
        text = re.sub(r'<[^>]+>', '', inner)
        href = unquote(href)
        return f'[{text}]({href})'

    # 使用非贪婪匹配，但需要处理嵌套 span
    html = re.sub(
        r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
        replace_link, html, flags=re.DOTALL)

    # 处理 inline-code：提取 inline-code span 内的纯文本（可能已含链接 markdown）
    # 飞书 inline-code 结构: <span class="inline-code ..."><span>text</span></span>
    def replace_inline_code(m):
        inner = m.group(1)
        # inner 可能已经包含处理过的链接 markdown
        return f'`{inner}`'

    html = re.sub(
        r'<span[^>]*inline-code[^>]*>.*?<span[^>]*>(.*?)</span>.*?</span>',
        replace_inline_code, html, flags=re.DOTALL)

    # 处理粗体
    html = re.sub(
        r'<span[^>]*font-weight:bold[^>]*>(.*?)</span>',
        r'**\1**', html, flags=re.DOTALL)

    # 处理 abbreviation
    html = re.sub(
        r'<span[^>]*abbreviation-text[^>]*>.*?<span[^>]*>(.*?)</span>.*?</span>',
        r'\1', html, flags=re.DOTALL)

    # 移除所有剩余的 HTML 标签
    text = re.sub(r'<[^>]+>', '', html)
    # 解码 HTML 实体
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    text = text.replace('&quot;', '"').replace('&apos;', "'").replace('&nbsp;', ' ')
    # 移除零宽空格
    text = text.replace('\u200b', '')

    return text


def extract_text_from_block(block_html):
    """从 block HTML 中提取纯文本行。"""
    lines = []
    for m in re.finditer(r'<div class="ace-line"[^>]*>(.*?)</div>', block_html, re.DOTALL):
        line_html = m.group(1)
        text = extract_inline_text(line_html)
        if text.strip():
            lines.append(text.strip())
    return lines


def extract_code_block(block_html):
    """提取代码块内容。"""
    lines = []
    for m in re.finditer(
            r'<div class="code-line-wrapper"[^>]*>(.*?)</div>\s*</div>',
            block_html, re.DOTALL):
        line_html = m.group(1)
        text = extract_inline_text(line_html)
        lines.append(text)

    lang = ''
    lang_m = re.search(r'<button[^>]*><span>(\w+)</span></button>', block_html)
    if lang_m:
        lang = lang_m.group(1).lower()

    return lang, lines


def extract_table(block_html):
    """提取表格内容。"""
    rows = []
    tr_pattern = re.compile(r'<tr[^>]*>(.*?)</tr>', re.DOTALL)
    for tr_m in tr_pattern.finditer(block_html):
        tr_html = tr_m.group(1)
        cells = []
        td_pattern = re.compile(r'<td[^>]*>(.*?)</td>', re.DOTALL)
        for td_m in td_pattern.finditer(tr_html):
            td_html = td_m.group(1)
            cell_lines = []
            for ace_m in re.finditer(r'<div class="ace-line"[^>]*>(.*?)</div>', td_html, re.DOTALL):
                text = extract_inline_text(ace_m.group(1))
                if text.strip():
                    cell_lines.append(text.strip())
            cells.append('<br>'.join(cell_lines) if cell_lines else '')
        if cells:
            rows.append(cells)
    return rows


def blocks_to_markdown(blocks):
    """将 block 列表转换为 Markdown。"""
    md_lines = []

    for block_type, block_html in blocks:
        if block_type == 'heading2':
            lines = extract_text_from_block(block_html)
            text = ' '.join(lines)
            if text:
                if md_lines and md_lines[-1] != '':
                    md_lines.append('')
                md_lines.append(f'## {text}')
                md_lines.append('')

        elif block_type == 'heading3':
            lines = extract_text_from_block(block_html)
            text = ' '.join(lines)
            if text:
                if md_lines and md_lines[-1] != '':
                    md_lines.append('')
                md_lines.append(f'### {text}')
                md_lines.append('')

        elif block_type == 'heading4':
            lines = extract_text_from_block(block_html)
            text = ' '.join(lines)
            if text:
                if md_lines and md_lines[-1] != '':
                    md_lines.append('')
                md_lines.append(f'#### {text}')
                md_lines.append('')

        elif block_type == 'heading5':
            lines = extract_text_from_block(block_html)
            text = ' '.join(lines)
            if text:
                if md_lines and md_lines[-1] != '':
                    md_lines.append('')
                md_lines.append(f'##### {text}')
                md_lines.append('')

        elif block_type == 'bullet':
            lines = extract_text_from_block(block_html)
            for line in lines:
                md_lines.append(f'- {line}')

        elif block_type == 'code':
            lang, code_lines = extract_code_block(block_html)
            if code_lines:
                if md_lines and md_lines[-1] != '':
                    md_lines.append('')
                md_lines.append(f'```{lang}')
                for line in code_lines:
                    md_lines.append(line)
                md_lines.append('```')
                md_lines.append('')

        elif block_type == 'table':
            rows = extract_table(block_html)
            if rows and len(rows) >= 1:
                # 过滤全空行
                rows = [r for r in rows if any(c.strip() for c in r)]
                if not rows:
                    continue
                if md_lines and md_lines[-1] != '':
                    md_lines.append('')
                header = rows[0]
                md_lines.append('| ' + ' | '.join(header) + ' |')
                md_lines.append('| ' + ' | '.join(['---'] * len(header)) + ' |')
                for row in rows[1:]:
                    padded = row + [''] * (len(header) - len(row))
                    padded = padded[:len(header)]
                    md_lines.append('| ' + ' | '.join(padded) + ' |')
                md_lines.append('')

        elif block_type == 'text':
            lines = extract_text_from_block(block_html)
            if lines:
                for line in lines:
                    md_lines.append(line)
                    md_lines.append('')
            elif 'isEmpty' in block_html:
                if md_lines and md_lines[-1] != '':
                    md_lines.append('')

    return '\n'.join(md_lines)


def main():
    html_file = sys.argv[1] if len(sys.argv) > 1 else 'deploy/higpt-openai-gateway/api.html'
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'docs/higpt-openai-gateway-api.md'

    print(f'解析文件: {html_file}')
    blocks = extract_content(html_file)

    if blocks is None:
        sys.exit(1)

    print(f'找到 {len(blocks)} 个顶层 block 元素')

    type_counts = {}
    for bt, _ in blocks:
        type_counts[bt] = type_counts.get(bt, 0) + 1
    print('Block 类型统计:')
    for bt, count in sorted(type_counts.items()):
        print(f'  {bt}: {count}')

    md_content = blocks_to_markdown(blocks)
    md_content = '# 大模型API接口文档\n\n' + md_content
    md_content = re.sub(r'\n{4,}', '\n\n\n', md_content)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(md_content)

    print(f'\nMarkdown 文档已生成: {output_file}')
    print(f'总行数: {len(md_content.splitlines())}')


if __name__ == '__main__':
    main()
