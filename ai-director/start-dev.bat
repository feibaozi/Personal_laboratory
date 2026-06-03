@echo off
chcp 65001 >nul
title AI Director Server

echo ============================================
echo   AI Director - Video Narrative Pipeline
echo ============================================
echo.

set DIR=%~dp0

echo [1/2] Starting backend server...
start "AI Director - Backend" cmd /c "cd /d %DIR%backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8788"
echo [OK] Backend: http://localhost:8788

echo [2/2] Starting frontend dev server...
start "AI Director - Frontend" cmd /c "cd /d %DIR%frontend && npx vite --host"
echo [OK] Frontend: http://localhost:5173

echo.
echo ============================================
echo   All services started!
echo.
echo   Backend API:  http://localhost:8788
echo   Frontend Dev: http://localhost:5173
echo   Frontend (via backend): http://localhost:8788
echo ============================================
echo.
echo Press any key to close this window (services will keep running)
pause >nul