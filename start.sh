#!/usr/bin/env bash
# SCI-Plotter 一键启动脚本 (Linux / macOS)
# 功能：检测/安装 Pixi → 检测/构建虚拟环境 → 检测/安装 sci-plotter → 启动 Desktop 应用

set -e

# ==================== 配置 ====================
PIXI_INSTALL_URL="https://pixi.sh/install.sh"
PIXI_DIR="$HOME/.pixi/bin"
PIXI_EXE_FALLBACK="$PIXI_DIR/pixi"

# ==================== 颜色输出 ====================
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info() { echo -e "${CYAN}>>> $1${NC}"; }
success() { echo -e "${GREEN}>>> $1${NC}"; }
warn() { echo -e "${YELLOW}>>> $1${NC}"; }
error() { echo -e "${RED}>>> $1${NC}"; }

# ==================== 查找项目根目录 ====================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

while [ "$PROJECT_ROOT" != "/" ] && [ ! -f "$PROJECT_ROOT/pixi.toml" ]; do
    PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
done

if [ ! -f "$PROJECT_ROOT/pixi.toml" ]; then
    error "未找到 pixi.toml，请将此脚本放在 SCI-Plotter 项目目录中运行"
    exit 1
fi

cd "$PROJECT_ROOT"
info "项目目录: $PROJECT_ROOT"

# ==================== Pixi 检测与安装 ====================
get_pixi_exe() {
    if command -v pixi &>/dev/null; then
        command -v pixi
    elif [ -x "$PIXI_EXE_FALLBACK" ]; then
        echo "$PIXI_EXE_FALLBACK"
    else
        echo ""
    fi
}

test_pixi_installed() {
    [ -n "$(get_pixi_exe)" ]
}

install_pixi() {
    warn "Pixi 未安装，正在自动下载安装..."

    # 检测操作系统
    OS="$(uname -s)"
    case "$OS" in
        Linux*|Darwin*)
            if command -v curl &>/dev/null; then
                curl -fsSL "$PIXI_INSTALL_URL" | bash
            elif command -v wget &>/dev/null; then
                wget -qO- "$PIXI_INSTALL_URL" | bash
            else
                error "需要 curl 或 wget 来下载 Pixi，请先安装其中之一"
                exit 1
            fi
            ;;
        *)
            error "不支持的操作系统: $OS"
            exit 1
            ;;
    esac

    if [ ! -x "$PIXI_EXE_FALLBACK" ]; then
        error "Pixi 自动安装失败，请手动安装后重试: https://pixi.sh"
        exit 1
    fi

    # 将 pixi 加入当前会话 PATH
    if [[ ":$PATH:" != *":$PIXI_DIR:"* ]]; then
        export PATH="$PIXI_DIR:$PATH"
    fi
    success "Pixi 安装完成"
}

# ==================== 虚拟环境检测与构建 ====================
test_environment_exists() {
    [ -d "$PROJECT_ROOT/.pixi" ]
}

test_sci_plotter_installed() {
    local pixi_exe="$1"
    if $pixi_exe list 2>/dev/null | grep -q "sci-plotter"; then
        return 0
    fi
    return 1
}

install_environment() {
    local pixi_exe="$1"
    warn "正在构建虚拟环境并安装依赖（首次安装可能需要几分钟）..."
    $pixi_exe install
    success "虚拟环境构建完成"
}

# ==================== 启动 Desktop 应用 ====================
start_sci_plotter() {
    local pixi_exe="$1"
    info "正在启动 SCI-Plotter Desktop..."
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  SCI-Plotter 已启动${NC}"
    echo -e "${CYAN}  关闭此终端或按 Ctrl+C 停止程序${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # pixi run 会调用 pyproject.toml 中定义的 sci-plotter 入口
    $pixi_exe run sci-plotter --dev
}

# ==================== 检测图形环境（无 GUI 时回退到 Lite） ====================
check_gui_available() {
    local os="$(uname -s)"
    case "$os" in
        Linux*)
            # 检查 DISPLAY 或 WAYLAND_DISPLAY
            if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ]; then
                return 1
            fi
            ;;
        Darwin*)
            # macOS 默认有 GUI
            return 0
            ;;
        *)
            return 0
            ;;
    esac
    return 0
}

start_lite_server() {
    local lite_dir="$PROJECT_ROOT/sci-plotter-lite"
    if [ ! -d "$lite_dir" ]; then
        error "未找到 sci-plotter-lite 目录"
        exit 1
    fi

    warn "未检测到图形界面，将启动 Lite 版本（HTTP 服务器 + 浏览器）..."

    # 查找可用端口
    local port=8080
    while lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; do
        port=$((port + 1))
    done

    info "启动 HTTP 服务器于 http://localhost:$port ..."
    cd "$lite_dir"
    python3 -m http.server "$port" &
    local server_pid=$!

    # 等待服务器启动
    sleep 1

    # 打开浏览器
    local url="http://localhost:$port"
    info "正在打开浏览器: $url"
    case "$(uname -s)" in
        Linux*) xdg-open "$url" 2>/dev/null || sensible-browser "$url" 2>/dev/null || echo "请手动打开 $url" ;;
        Darwin*) open "$url" ;;
    esac

    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  SCI-Plotter Lite 已启动${NC}"
    echo -e "${CYAN}  访问地址: $url${NC}"
    echo -e "${CYAN}  按 Ctrl+C 停止服务器${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    wait $server_pid
}

# ==================== 主流程 ====================
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   SCI-Plotter 一键启动器${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 1. 确保 Pixi 已安装
if test_pixi_installed; then
    success "Pixi 已安装"
else
    install_pixi
fi

PIXI_EXE="$(get_pixi_exe)"
info "Pixi 路径: $PIXI_EXE"

# 2. 确保虚拟环境存在且包含 sci-plotter
if ! test_environment_exists; then
    warn "虚拟环境不存在"
    install_environment "$PIXI_EXE"
elif ! test_sci_plotter_installed "$PIXI_EXE"; then
    warn "虚拟环境已存在，但缺少 sci-plotter 包"
    install_environment "$PIXI_EXE"
else
    success "虚拟环境已就绪，sci-plotter 已安装"
fi

# 3. 验证 sci-plotter 命令可用
if ! $PIXI_EXE run sci-plotter --help &>/dev/null; then
    warn "正在修复 sci-plotter CLI 入口..."
    install_environment "$PIXI_EXE"
fi

# 4. 根据环境启动对应版本
if check_gui_available; then
    start_sci_plotter "$PIXI_EXE"
else
    start_lite_server
fi
