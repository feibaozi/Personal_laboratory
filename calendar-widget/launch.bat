@echo off
REM Calendar Widget Launcher
REM Ensure ELECTRON_RUN_AS_NODE is not set
set ELECTRON_RUN_AS_NODE=

REM Also clean from registry to prevent future issues
reg delete HKCU\Environment /v ELECTRON_RUN_AS_NODE /f >nul 2>&1

cd /d "%~dp0"

REM Run Electron directly
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."

REM If Electron failed to start, show error
if errorlevel 1 (
    echo [ERROR] Failed to start Calendar Widget.
    echo Make sure Node.js and Electron are installed correctly.
    pause
)
