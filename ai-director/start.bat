@echo off
chcp 65001 >nul
title AI Director Production

echo ============================================
echo   AI Director - Production Mode
echo ============================================
echo.

set DIR=%~dp0

echo [1/2] Building frontend...
cd /d %DIR%frontend
call npx vite build
if %errorlevel% neq 0 (
    echo [FAIL] Frontend build failed
    pause
    exit /b 1
)
echo [OK] Frontend built

echo.
echo [2/2] Starting server...
cd /d %DIR%backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8788

pause