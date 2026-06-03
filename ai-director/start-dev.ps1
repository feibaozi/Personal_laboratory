Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  AI Director - Video Narrative Pipeline"   -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[1/2] Starting backend server..." -ForegroundColor Yellow
$backendJob = Start-Process -FilePath "python" -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8788" -WorkingDirectory "$root\backend" -PassThru -WindowStyle Minimized
Write-Host "[OK] Backend: http://localhost:8788" -ForegroundColor Green

Write-Host "[2/2] Starting frontend dev server..." -ForegroundColor Yellow
$frontendJob = Start-Process -FilePath "npx" -ArgumentList "vite", "--host" -WorkingDirectory "$root\frontend" -PassThru -WindowStyle Minimized
Write-Host "[OK] Frontend: http://localhost:5173" -ForegroundColor Green

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  All services started!"                    -ForegroundColor Green
Write-Host ""
Write-Host "  Backend API:  http://localhost:8788"
Write-Host "  Frontend Dev: http://localhost:5173"
Write-Host "  Frontend (via backend): http://localhost:8788"
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to stop all services..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Stop-Process -Id $backendJob.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontendJob.Id -Force -ErrorAction SilentlyContinue
Write-Host "All services stopped." -ForegroundColor Yellow