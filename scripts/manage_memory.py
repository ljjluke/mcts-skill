#!/usr/bin/env python3
"""
MCTS-TD 记忆管理工具
管理知识图谱的 active/archive 分层存储，模拟人脑遗忘与回忆。

功能:
  1. archive_old — 将超过60天未使用的知识从 active 移入 archive
  2. recall — 从 archive 中搜索匹配的知识并移回 active
  3. cleanup — 清理超过1年的深度归档
  4. status — 查看当前记忆状态
"""

import os
import re
import sys
import json
from datetime import datetime, timedelta
from pathlib import Path

# 路径配置
SKILL_DIR = Path.home() / ".claude" / "skills" / "mcts-td-planner"
ACTIVE_FILE = SKILL_DIR / "memory" / "mcts-td-value-archive.md"
ARCHIVE_DIR = SKILL_DIR / "memory" / "archive"

# 如果找不到 skill 目录，尝试用项目目录
if not SKILL_DIR.exists():
    SKILL_DIR = Path.cwd()

# 确保目录存在
ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)


def parse_knowledge_entries(text: str) -> list:
    """从 markdown 表格中解析知识条目"""
    entries = []
    lines = text.split('\n')
    in_table = False
    headers = []

    for line in lines:
        # 检测表格开始
        if line.strip().startswith('| ID |'):
            in_table = True
            headers = [h.strip() for h in line.split('|')[1:-1]]
            continue
        if in_table and line.strip().startswith('|---'):
            continue
        if in_table and line.strip().startswith('| ') and '| — ' not in line:
            cells = [c.strip() for c in line.split('|')[1:-1]]
            if len(cells) >= len(headers):
                entry = dict(zip(headers, cells))
                entries.append(entry)
        elif in_table and not line.strip().startswith('|'):
            in_table = False

    return entries


def build_table(headers: list, entries: list) -> str:
    """构建 markdown 表格"""
    if not entries:
        return '| ' + ' | '.join(headers) + ' |\n| ' + ' | '.join(['---'] * len(headers)) + ' |\n| — | — | — | — | — | — | — | — | — | — | — |\n'

    lines = []
    lines.append('| ' + ' | '.join(headers) + ' |')
    lines.append('| ' + ' | '.join(['---'] * len(headers)) + ' |')
    for entry in entries:
        row = [str(entry.get(h, '')) for h in headers]
        lines.append('| ' + ' | '.join(row) + ' |')
    return '\n'.join(lines) + '\n'


def read_file(path: Path) -> str:
    """读取文件"""
    if not path.exists():
        return ''
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def write_file(path: Path, content: str):
    """写入文件"""
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)


def get_consolidation_score(entry: dict) -> int:
    """获取巩固分"""
    try:
        return int(entry.get('巩固分', '0'))
    except (ValueError, TypeError):
        return 0


def get_last_verified(entry: dict) -> datetime:
    """获取最后验证时间"""
    date_str = entry.get('最后验证', '').strip()
    if not date_str or date_str == '—':
        return datetime.min
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        return datetime.min


def get_status(entry: dict) -> str:
    """获取状态"""
    return entry.get('状态', 'HYPOTHESIS').strip()


def cmd_archive(days: int = 60, min_score: int = 3):
    """
    将超过 days 天未使用且巩固分 <= min_score 的知识从 active 移入 archive。

    模拟人脑：很久不用的事慢慢忘了。
    """
    content = read_file(ACTIVE_FILE)
    if not content:
        print("❌ active 记忆文件不存在")
        return

    # 解析知识条目
    entries = parse_knowledge_entries(content)
    if not entries:
        print("ℹ️ active 中没有知识条目")
        return

    now = datetime.now()
    active_entries = []
    archived_entries = []

    for entry in entries:
        score = get_consolidation_score(entry)
        last_verified = get_last_verified(entry)
        days_since_verified = (now - last_verified).days

        should_archive = (
            days_since_verified > days
            and score <= min_score
            and get_status(entry) != 'CONFIRMED'
        )

        if should_archive:
            archived_entries.append(entry)
        else:
            active_entries.append(entry)

    if not archived_entries:
        print(f"ℹ️ 没有需要归档的知识条目（{days}天未使用 + 巩固分≤{min_score}）")
        return

    # 写入 archive 文件
    archive_filename = f"archive-{now.strftime('%Y-%m')}.md"
    archive_path = ARCHIVE_DIR / archive_filename

    # 构建 archive 内容
    archive_content = f"""---
name: mcts-td-value-archive
description: MCTS-TD 引擎的归档知识（{now.strftime('%Y年%m月')}）
metadata:
  type: archive
---

## 知识条目表

归档时间: {now.strftime('%Y-%m-%d %H:%M')}

| ID | 特征 | q | σ² | n | 状态 | tags | 上下文 | 巩固分 | 创建时间 | 最后验证 |
|----|------|---|----|----|-----|------|--------|-------|---------|---------|
"""

    for entry in archived_entries:
        row = '| ' + ' | '.join([
            entry.get('ID', '—'),
            entry.get('特征', '—'),
            entry.get('q', '—'),
            entry.get('σ²', '—'),
            entry.get('n', '—'),
            entry.get('状态', '—'),
            entry.get('tags', '—'),
            entry.get('上下文', '—'),
            entry.get('巩固分', '0'),
            entry.get('创建时间', '—'),
            entry.get('最后验证', '—')
        ]) + ' |\n'
        archive_content += row

    # 追加到 archive 文件
    existing_archive = read_file(archive_path)
    if existing_archive:
        # 找到表格开始位置，追加行
        lines = existing_archive.split('\n')
        # 找到最后一个表格行
        last_table_line = len(lines) - 1
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].strip().startswith('| ') and '| — ' not in lines[i]:
                last_table_line = i
                break
        # 在最后一行前插入新行
        for entry in archived_entries:
            row = '| ' + ' | '.join([
                entry.get('ID', '—'),
                entry.get('特征', '—'),
                entry.get('q', '—'),
                entry.get('σ²', '—'),
                entry.get('n', '—'),
                entry.get('状态', '—'),
                entry.get('tags', '—'),
                entry.get('上下文', '—'),
                entry.get('巩固分', '0'),
                entry.get('创建时间', '—'),
                entry.get('最后验证', '—')
            ]) + ' |'
            lines.insert(last_table_line + 1, row)
        archive_content = '\n'.join(lines)
    else:
        # 新文件
        pass

    write_file(archive_path, archive_content)

    # 更新 active 文件
    headers = ['ID', '特征', 'q', 'σ²', 'n', '状态', 'tags', '上下文', '巩固分', '创建时间', '最后验证']
    table = build_table(headers, active_entries)

    # 替换 active 文件中的表格
    new_content = content
    # 找到表格区域并替换
    table_start = content.find('| ID |')
    if table_start >= 0:
        # 找到表格结束位置
        rest = content[table_start:]
        table_end = rest.find('\n\n')
        if table_end < 0:
            table_end = len(rest)
        new_content = content[:table_start] + table + content[table_start + table_end:]

    write_file(ACTIVE_FILE, new_content)

    print(f"✅ 归档完成: {len(archived_entries)} 条知识移入 {archive_filename}")
    print(f"   active 剩余: {len(active_entries)} 条")
    print(f"   archive 新增: {len(archived_entries)} 条")


def cmd_recall(keywords: list):
    """
    从 archive 中搜索匹配的知识并移回 active。

    模拟人脑：被人一提又想起来了。
    """
    if not keywords:
        print("❌ 请提供搜索关键词")
        print("用法: python scripts/manage_memory.py recall <关键词1> <关键词2> ...")
        return

    archive_files = sorted(ARCHIVE_DIR.glob("*.md"))
    if not archive_files:
        print("ℹ️ archive 目录为空")
        return

    recalled = []

    for af in archive_files:
        content = read_file(af)
        if not content:
            continue

        entries = parse_knowledge_entries(content)
        for entry in entries:
            # 搜索 tags 和特征中是否包含关键词
            text = entry.get('tags', '') + ' ' + entry.get('特征', '')
            if any(kw.lower() in text.lower() for kw in keywords):
                entry['状态'] = 'HYPOTHESIS'  # 回忆起来的需要重新验证
                entry['巩固分'] = '5'  # 重置巩固分
                recalled.append(entry)

    if not recalled:
        print(f"ℹ️ 在 archive 中未找到匹配 '{' '.join(keywords)}' 的知识")
        return

    # 将回忆起来的知识追加到 active
    active_content = read_file(ACTIVE_FILE)
    headers = ['ID', '特征', 'q', 'σ²', 'n', '状态', 'tags', '上下文', '巩固分', '创建时间', '最后验证']

    # 找到表格行，追加新行
    lines = active_content.split('\n')
    last_table_line = len(lines) - 1
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip().startswith('| ') and '| — ' not in lines[i]:
            last_table_line = i
            break

    for entry in recalled:
        row = '| ' + ' | '.join([
            entry.get('ID', '—'),
            entry.get('特征', '—'),
            entry.get('q', '—'),
            entry.get('σ²', '—'),
            entry.get('n', '1'),
            'HYPOTHESIS',
            entry.get('tags', '—'),
            entry.get('上下文', '—'),
            '5',
            entry.get('创建时间', '—'),
            datetime.now().strftime('%Y-%m-%d')
        ]) + ' |'
        lines.insert(last_table_line + 1, row)

    write_file(ACTIVE_FILE, '\n'.join(lines))

    print(f"✅ 回忆完成: {len(recalled)} 条知识从 archive 移回 active")
    for entry in recalled:
        print(f"   - {entry.get('ID', '?')}: {entry.get('特征', '?')}")


def cmd_cleanup(days: int = 365):
    """
    清理超过 days 天的深度归档文件。

    模拟人脑：彻底想不起来了。
    """
    now = datetime.now()
    cleaned = 0

    for af in ARCHIVE_DIR.glob("*.md"):
        # 从文件名解析月份
        match = re.search(r'(\d{4})-(\d{2})', af.stem)
        if match:
            file_date = datetime(int(match.group(1)), int(match.group(2)), 1)
            if (now - file_date).days > days:
                af.unlink()
                cleaned += 1
                print(f"   🗑️ 删除: {af.name}")

    print(f"✅ 深度归档清理完成: 删除了 {cleaned} 个文件")
    return cleaned


def cmd_status():
    """查看当前记忆状态"""
    # Active 状态
    active_content = read_file(ACTIVE_FILE)
    active_entries = parse_knowledge_entries(active_content)
    active_count = len(active_entries)

    # 按状态统计
    status_count = {}
    for entry in active_entries:
        s = get_status(entry)
        status_count[s] = status_count.get(s, 0) + 1

    # Archive 状态
    archive_files = sorted(ARCHIVE_DIR.glob("*.md"))
    archive_count = 0
    for af in archive_files:
        content = read_file(af)
        archive_count += len(parse_knowledge_entries(content))

    print("\n🧠 MCTS-TD 记忆状态")
    print("=" * 40)
    print(f"\n📂 Active（当前意识）: {active_count} 条")
    for s, c in sorted(status_count.items()):
        bar = '█' * (c // 2) if c > 0 else ''
        print(f"   {s:15s}: {c:3d} 条 {bar}")
    print(f"\n📦 Archive（长期记忆）: {archive_count} 条")
    print(f"   归档文件: {len(archive_files)} 个")
    for af in archive_files:
        content = read_file(af)
        count = len(parse_knowledge_entries(content))
        size = os.path.getsize(af)
        print(f"   {af.name:25s} {count:3d} 条 ({size:,} bytes)")


def main():
    if len(sys.argv) < 2:
        print("MCTS-TD 记忆管理工具")
        print("=" * 40)
        print("\n用法:")
        print("  python scripts/manage_memory.py archive     归档旧知识")
        print("  python scripts/manage_memory.py recall kw   从 archive 回忆知识")
        print("  python scripts/manage_memory.py cleanup     清理深度归档")
        print("  python scripts/manage_memory.py status      查看记忆状态")
        print("\n示例:")
        print("  python scripts/manage_memory.py archive --days 30")
        print("  python scripts/manage_memory.py recall 'FastAPI' '参数校验'")
        print("  python scripts/manage_memory.py cleanup --days 180")
        return

    cmd = sys.argv[1]

    if cmd == 'archive':
        days = 60
        if '--days' in sys.argv:
            idx = sys.argv.index('--days')
            if idx + 1 < len(sys.argv):
                days = int(sys.argv[idx + 1])
        cmd_archive(days=days)

    elif cmd == 'recall':
        keywords = sys.argv[2:]
        cmd_recall(keywords)

    elif cmd == 'cleanup':
        days = 365
        if '--days' in sys.argv:
            idx = sys.argv.index('--days')
            if idx + 1 < len(sys.argv):
                days = int(sys.argv[idx + 1])
        cmd_cleanup(days=days)

    elif cmd == 'status':
        cmd_status()

    else:
        print(f"未知命令: {cmd}")
        sys.exit(1)


if __name__ == '__main__':
    main()