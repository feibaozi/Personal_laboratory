@echo off
chcp 65001 >nul
echo ============================================
echo 🍔 Foodie Comparison - 一键启动全部服务
echo ============================================
echo.

cd /d "c:\Users\hexi\Desktop\VScode\foodie_comparison"

echo [1/3] 启动 Docker 容器...
docker-compose up -d

echo.
echo [2/3] 等待后端服务就绪...
:WAIT_BACKEND
curl -s http://localhost:8000/api/coupons/home >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 后端服务已就绪
) else (
    echo ⏳ 等待中...
    timeout /t 3 /nobreak >nul
    goto WAIT_BACKEND
)

echo.
echo [3/3] 启动 Flutter 应用...
start "" "start_frontend.bat"

echo.
echo 🎉 全部服务启动完成！
echo 📡 API 文档: http://localhost:8000/docs
echo 📱 前端应用: 将在 Chrome 中打开
echo.
pause