#!/usr/bin/env pwsh
# SCI-Plotter 一键启动脚本 (Windows)
# 功能：检测/安装 Pixi → 检测/构建虚拟环境 → 检测/安装 sci-plotter → 启动 Desktop 应用

$ErrorActionPreference = "Stop"

# ==================== 配置 ====================
$PixiInstallUrl = "https://pixi.sh/install.ps1"
$PixiDir = "$env:USERPROFILE\.pixi\bin"
$PixiExeFallback = "$PixiDir\pixi.exe"

# ==================== 颜色输出 ====================
function Write-Info($msg) { Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host ">>> $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host ">>> $msg" -ForegroundColor Yellow }
function Write-ErrorMsg($msg) { Write-Host ">>> $msg" -ForegroundColor Red }

# ==================== 查找项目根目录 ====================
$ScriptDir = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { Get-Location }
$ProjectRoot = $ScriptDir
while ($ProjectRoot -and -not (Test-Path (Join-Path $ProjectRoot "pixi.toml"))) {
    $Parent = Split-Path -Parent $ProjectRoot
    if ($Parent -eq $ProjectRoot) { break }
    $ProjectRoot = $Parent
}

if (-not (Test-Path (Join-Path $ProjectRoot "pixi.toml"))) {
    Write-ErrorMsg "未找到 pixi.toml，请将此脚本放在 SCI-Plotter 项目目录中运行"
    exit 1
}

Set-Location $ProjectRoot
Write-Info "项目目录: $ProjectRoot"

# ==================== Pixi 检测与安装 ====================
function Get-PixiExe {
    $cmd = Get-Command pixi -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    if (Test-Path $PixiExeFallback) { return $PixiExeFallback }
    return $null
}

function Test-PixiInstalled {
    return $null -ne (Get-PixiExe)
}

function Install-Pixi {
    Write-Warn "Pixi 未安装，正在自动下载安装..."
    try {
        $installScript = Invoke-WebRequest -Uri $PixiInstallUrl -UseBasicParsing -TimeoutSec 60
        Invoke-Expression $installScript.Content
    } catch {
        $tmpFile = [System.IO.Path]::GetTempFileName() + ".ps1"
        try {
            Invoke-WebRequest -Uri $PixiInstallUrl -OutFile $tmpFile -UseBasicParsing -TimeoutSec 60
            & $tmpFile
        } finally {
            Remove-Item $tmpFile -ErrorAction SilentlyContinue
        }
    }

    if (-not (Test-Path $PixiExeFallback)) {
        Write-ErrorMsg "Pixi 自动安装失败，请手动安装后重试: https://pixi.sh"
        exit 1
    }

    if (-not $env:PATH.Contains($PixiDir)) {
        $env:PATH = "$PixiDir;$env:PATH"
    }
    Write-Success "Pixi 安装完成"
}

# ==================== 虚拟环境检测与构建 ====================
function Test-EnvironmentExists {
    return Test-Path ".pixi"
}

function Test-SciPlotterInstalled {
    param([string]$PixiExe)
    try {
        $output = & $PixiExe list 2>$null | Out-String
        return $output.Contains("sci-plotter")
    } catch {
        return $false
    }
}

function Install-Environment {
    param([string]$PixiExe)
    Write-Warn "正在构建虚拟环境并安装依赖（首次安装可能需要几分钟）..."
    & $PixiExe install
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "pixi install 执行失败，请检查网络连接或 pixi.toml 配置"
        exit 1
    }
    Write-Success "虚拟环境构建完成"
}

# ==================== 启动 Desktop 应用 ====================
function Start-SciPlotter {
    param([string]$PixiExe)
    Write-Info "正在启动 SCI-Plotter Desktop..."
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  SCI-Plotter 已启动" -ForegroundColor Cyan
    Write-Host "  关闭此窗口或按 Ctrl+C 停止程序" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    & $PixiExe run dev
}

# ==================== 主流程 ====================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SCI-Plotter 一键启动器" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (Test-PixiInstalled) {
    Write-Success "Pixi 已安装"
} else {
    Install-Pixi
}

$PixiExe = Get-PixiExe
Write-Info "Pixi 路径: $PixiExe"

if (-not (Test-EnvironmentExists)) {
    Write-Warn "虚拟环境不存在"
    Install-Environment -PixiExe $PixiExe
} elseif (-not (Test-SciPlotterInstalled -PixiExe $PixiExe)) {
    Write-Warn "虚拟环境已存在，但缺少 sci-plotter 包"
    Install-Environment -PixiExe $PixiExe
} else {
    Write-Success "虚拟环境已就绪，sci-plotter 已安装"
}

$cliCheck = & $PixiExe run python -m sci_plotter --help 2>&1 | Out-String
if (-not $cliCheck.Contains("usage:")) {
    Write-Warn "正在修复 sci-plotter CLI 入口..."
    Install-Environment -PixiExe $PixiExe
}

Start-SciPlotter -PixiExe $PixiExe