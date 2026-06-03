@echo off
chcp 65001 >nul
title AI Director Quick Backend

set DIR=%~dp0
cd /d %DIR%backend
echo Starting AI Director backend on http://localhost:8788
echo.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8788
pause