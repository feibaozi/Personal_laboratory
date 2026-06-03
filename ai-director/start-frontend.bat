@echo off
chcp 65001 >nul
title AI Director Quick Frontend

set DIR=%~dp0
cd /d %DIR%frontend
echo Starting AI Director frontend on http://localhost:5173
echo.
call npx vite --host
pause