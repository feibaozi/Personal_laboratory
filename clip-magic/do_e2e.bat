@echo off
cd /d "%~dp0"
set PYTHONPATH=%~dp0
.venv_e2e\Scripts\python.exe e2e_test.py
