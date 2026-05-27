Set-Location "$PSScriptRoot"

if (-not (Test-Path "dist-electron\main.js")) {
    Write-Host "Building..."
    npm run build:desktop
    if ($LASTEXITCODE -ne 0) {
        Read-Host "Build failed, press Enter to exit"
        exit 1
    }
}

npx electron .