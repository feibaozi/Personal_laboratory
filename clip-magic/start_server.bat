@echo off
cd /d "%~dp0"
set PYTHONPATH=.
echo Starting Clip Magic Server on http://localhost:8787
echo Frontend: http://localhost:8787
echo.
.venv\Scripts\python.exe -m clip_magic.server