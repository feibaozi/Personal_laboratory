@echo off
chcp 65001 >nul
echo ============================================
echo 🍔 Foodie Comparison - 启动后端服务
echo ============================================
echo.

cd /d "c:\Users\hexi\Desktop\VScode\foodie_comparison"

echo [1/1] 启动 Docker 容器...
docker-compose up -d

echo.
echo ✅ 后端服务启动完成！
echo 📡 API 文档: http://localhost:8000/docs
echo 📊 首页优惠券: http://localhost:8000/api/coupons/home
echo.
pause