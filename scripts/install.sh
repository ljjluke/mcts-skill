#!/usr/bin/env bash
# =============================================================================
# MCTS-TD Planner — 一键安装脚本
# 自动检测当前平台（Claude Code / Cursor / OpenCode / Trae / CodeX）
# 并将对应的配置文件复制到正确位置。
# =============================================================================

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}ℹ️${NC} $1"; }
ok()    { echo -e "${GREEN}✅${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠️${NC} $1"; }
error() { echo -e "${RED}❌${NC} $1"; }

# 项目根目录（脚本所在目录的上级）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# =============================================================================
# 平台检测
# =============================================================================

detect_platform() {
    # 检测 Claude Code
    if [ -n "${CLAUDE_CODE:-}" ] || command -v claude >/dev/null 2>&1; then
        # 检查是否在 Claude Code 会话中
        if [ -n "${CLAUDE_CODE:-}" ]; then
            echo "claude-code"
            return
        fi
    fi

    # 检测 Cursor
    if [ -n "${CURSOR_TRACE_ID:-}" ] || [ -f ".cursor/rules" ]; then
        echo "cursor"
        return
    fi

    # 检测 OpenCode
    if [ -f ".opencode/rules" ] || [ -n "${OPENCODE:-}" ]; then
        echo "opencode"
        return
    fi

    # 检测 Trae（通过环境变量或配置文件）
    if [ -n "${TRAE_ENV:-}" ] || [ -f ".trae/rules" ]; then
        echo "trae"
        return
    fi

    # 检测 CodeX
    if [ -n "${CODEX_AGENT:-}" ] || [ -f ".codex/rules" ]; then
        echo "codex"
        return
    fi

    # 未检测到已知平台
    echo "unknown"
}

# =============================================================================
# 各平台安装函数
# =============================================================================

install_claude_code() {
    info "检测到 Claude Code..."

    # Claude Code 的 SKILL 安装路径
    local skill_dir="$HOME/.claude/skills/mcts-td-planner"
    mkdir -p "$skill_dir"

    # 复制核心文件
    cp "$PROJECT_DIR/SKILL.md" "$skill_dir/"
    cp "$PROJECT_DIR/plugin.json" "$skill_dir/" 2>/dev/null || true

    # 复制目录结构
    for dir in engine policies agents references memory/archive scripts deploy; do
        if [ -d "$PROJECT_DIR/$dir" ]; then
            mkdir -p "$skill_dir/$dir"
            cp -r "$PROJECT_DIR/$dir"/* "$skill_dir/$dir/" 2>/dev/null || true
        fi
    done

    # 初始化记忆数据目录（如果不存在）
    local data_dir="$HOME/.claude/data/skills/mcts-td-planner"
    if [ ! -f "$data_dir/memory/mcts-td-value-archive.md" ]; then
        mkdir -p "$data_dir/memory/archive"
        cp "$PROJECT_DIR/memory/mcts-td-value-archive.md" "$data_dir/memory/" 2>/dev/null || true
        ok "记忆数据目录已初始化"
    else
        info "记忆数据目录已存在，跳过初始化（数据保留）"
    fi

    ok "Claude Code 安装完成！"
    info "Skill 已安装到: $skill_dir"
    info "记忆数据存储在: $data_dir"
}

install_cursor() {
    info "检测到 Cursor..."

    local target_dir="$PROJECT_DIR/.cursor/rules"
    mkdir -p "$target_dir"
    cp "$PROJECT_DIR/deploy/cursor/rules/decision-engine.mdc" "$target_dir/"
    cp "$PROJECT_DIR/deploy/cursor/README.md" "$PROJECT_DIR/.cursor/" 2>/dev/null || true

    ok "Cursor 安装完成！"
    info "配置文件已复制到: $target_dir"
}

install_opencode() {
    info "检测到 OpenCode..."

    local target_dir="$PROJECT_DIR/.opencode/rules"
    mkdir -p "$target_dir"
    cp "$PROJECT_DIR/deploy/opencode/rules/decision-engine.mdc" "$target_dir/"
    cp "$PROJECT_DIR/deploy/opencode/README.md" "$PROJECT_DIR/.opencode/" 2>/dev/null || true

    ok "OpenCode 安装完成！"
    info "配置文件已复制到: $target_dir"
}

install_trae() {
    info "检测到 Trae..."
    warn "Trae 需要手动将配置文件内容添加到项目规则中。"
    info "请打开 Trae 设置，并将以下文件内容添加到项目规则："
    info "  $PROJECT_DIR/deploy/trae/instructions.md"
    echo ""
    echo "--- 建议的操作 ---"
    echo "1. 在 Trae 中打开项目设置"
    echo "2. 找到 '项目规则' 或 'Agent 指令'"
    echo "3. 将 deploy/trae/instructions.md 的内容复制进去"
    echo "------------------"
}

install_codex() {
    info "检测到 CodeX..."
    warn "CodeX 需要手动将配置文件内容添加到 Agent 系统提示中。"
    info "请将以下文件内容添加到 CodeX Agent 的系统提示："
    info "  $PROJECT_DIR/deploy/codex/instructions.md"
    echo ""
    echo "--- 建议的操作 ---"
    echo "1. 在 CodeX 中打开 Agent 配置"
    echo "2. 找到 '系统提示' 或 'System Prompt'"
    echo "3. 将 deploy/codex/instructions.md 的内容追加到末尾"
    echo "------------------"
}

install_unknown() {
    info "未能自动检测到已知平台。"

    # 列出所有可用平台
    echo ""
    echo "可用平台:"
    echo "  1) Claude Code"
    echo "  2) Cursor"
    echo "  3) OpenCode"
    echo "  4) Trae"
    echo "  5) CodeX"

    # 让用户选择
    echo ""
    read -p "请选择平台 (1-5): " choice

    case "$choice" in
        1) install_claude_code ;;
        2) install_cursor ;;
        3) install_opencode ;;
        4) install_trae ;;
        5) install_codex ;;
        *) error "无效选择" ;;
    esac
}

# =============================================================================
# 主流程
# =============================================================================

main() {
    echo ""
    echo "==========================================="
    echo "  🧠 MCTS-TD Planner — 一键安装"
    echo "==========================================="
    echo ""

    # 检查项目目录完整性
    if [ ! -f "$PROJECT_DIR/SKILL.md" ]; then
        error "未找到 SKILL.md，请确保在项目根目录运行此脚本"
        info "当前目录: $PROJECT_DIR"
        exit 1
    fi

    # 检测平台
    local platform
    platform=$(detect_platform)
    info "当前平台: $platform"

    echo ""

    # 按平台安装
    case "$platform" in
        claude-code) install_claude_code ;;
        cursor)      install_cursor ;;
        opencode)    install_opencode ;;
        trae)        install_trae ;;
        codex)       install_codex ;;
        *)           install_unknown ;;
    esac

    echo ""
    echo "==========================================="
    echo "  🎉 安装完成！"
    echo "==========================================="
    echo ""
    info "各平台使用方法："
    echo "  Claude Code: 输入任意任务，看到 ⚡ 标志说明生效"
    echo "  Cursor:      重启 Cursor 后生效"
    echo "  OpenCode:    重启 OpenCode 后生效"
    echo "  Trae/CodeX:  按上述说明完成手动配置后生效"
    echo ""
}

main "$@"