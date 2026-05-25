@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo    Clip Magic — 一键安装
echo ============================================
echo.

echo [1/3] 安装核心依赖...
pip install -e .
if %errorlevel% neq 0 (
    echo 安装失败，请检查 Python 和 pip 环境
    pause
    exit /b 1
)

echo [2/3] 检查配置文件...
if not exist ".env" (
    copy .env.example .env
    echo 已从 .env.example 创建 .env 配置文件
    echo 请编辑 .env 填入你的 LLM API Key
) else (
    echo .env 配置文件已存在
)

echo [3/3] 验证安装...
pip show clip-magic >nul 2>&1
if %errorlevel% equ 0 (
    echo 安装成功！
    echo.
    echo 快速开始:
    echo   下载模型:    clip-magic model download -s medium
    echo   环境诊断:    clip-magic check
    echo   处理视频:    clip-magic run video.mp4
    echo   查看帮助:    clip-magic --help
) else (
    echo 警告: clip-magic 包未正确安装，请手动检查
)

echo.
pause