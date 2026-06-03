@echo off
chcp 65001 >nul
title AI Director - 测试脚本

echo ============================================
echo   AI Director 端到端测试
echo ============================================
echo.

set API=http://localhost:8788

echo [1/6] 检查服务是否启动...
curl -s "%API%" >nul 2>&1
if %errorlevel% neq 0 (
    echo [FAIL] 后端服务未启动，请先运行 start-dev.bat
    pause
    exit /b 1
)
echo [OK] 服务已启动

echo.
echo [2/6] 测试叙事生成（三幕式，无素材）...
curl -s "%API%/api/narrative/generate?theme=我的2024年度回顾&narrative_type=three_act&target_duration_sec=120"
echo.

echo.
echo [3/6] 测试叙事生成（五段式，无素材）...
curl -s "%API%/api/narrative/generate?theme=如何在30天内学会一项新技能&narrative_type=five_stage&target_duration_sec=180"
echo.

echo.
echo [4/6] 测试叙事生成（蒙太奇，无素材）...
curl -s "%API%/api/narrative/generate?theme=城市里的每一个清晨&narrative_type=montage&target_duration_sec=60"
echo.

echo.
echo [5/6] 测试流水线（分镜+匹配）...
curl -s -X POST "%API%/api/narrative/pipeline" ^
    -H "Content-Type: application/json" ^
    -d "{\"theme\":\"一次说走就走的旅行\",\"narrative_type\":\"montage\",\"target_duration_sec\":60}"
echo.

echo.
echo [6/6] 测试转场列表...
curl -s "%API%/api/compose/transitions"
echo.

echo.
echo ============================================
echo   测试完成！
echo ============================================
echo.
echo 建议下一步：
echo   1. 在浏览器打开 http://localhost:8788
echo   2. 输入主题并体验分镜生成
echo   3. 如果配置了 LLM API Key，生成效果会更好
echo ============================================
pause