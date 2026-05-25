@echo off
cd /d "%~dp0"
call .venv\Scripts\python.exe -m clip_magic.cli %*