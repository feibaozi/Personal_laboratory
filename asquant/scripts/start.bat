@echo off
title AsQuant Launcher
set ROOT=%~dp0..
cd /d "%ROOT%"

echo ============================================
echo   AsQuant - Quant Research Platform
echo ============================================
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

echo [1/2] Starting backend on port 8000 ...
start "AsQuant-Backend" /min cmd /c "cd /d backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 4 /nobreak >nul

echo [2/2] Starting frontend on port 5173 ...
start "AsQuant-Frontend" /min cmd /c "cd /d frontend && npx vite --host 0.0.0.0"
timeout /t 3 /nobreak >nul

start "" "http://localhost:5173"

echo.
echo ============================================
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo ============================================
echo.
echo   Close this window to stop ALL services.
echo.

pause
taskkill /FI "WINDOWTITLE eq AsQuant-Backend*" >nul 2>&1
taskkill /FI "WINDOWTITLE eq AsQuant-Frontend*" >nul 2>&1
