@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

if not exist "dist-electron\main.js" (
    echo ⚙️ 首次运行，正在构建...
    call npm run build:desktop
    if errorlevel 1 (
        echo.
        echo ❌ 构建失败，请检查错误信息
        pause
        exit /b 1
    )
)

echo 🚀 正在启动 ThinkGarden...
start "" "npx" electron .