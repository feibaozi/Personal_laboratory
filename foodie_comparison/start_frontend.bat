@echo off
chcp 65001 >nul
echo ============================================
echo 🍔 Foodie Comparison - 启动前端应用
echo ============================================
echo.

cd /d "c:\Users\hexi\Desktop\VScode\foodie_comparison"

echo [1/2] 检查后端服务状态...
curl -s http://localhost:8000/api/coupons/home >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ 后端服务已就绪
) else (
    echo ⚠️  后端服务未启动，请先运行 start_backend.bat
    pause
    exit /b 1
)

echo.
echo [2/2] 启动 Flutter 应用...
"C:\Users\hexi\develop\flutter_windows_3.44.0-stable\flutter\bin\flutter.bat" run -d chrome

echo.
echo 🎉 前端应用启动完成！
pause