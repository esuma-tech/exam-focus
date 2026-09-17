# EXAM FOCUS — start backend + frontend for development
# Usage:  powershell -ExecutionPolicy Bypass -File .\start-dev.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process -FilePath "python" `
  -ArgumentList "-m","uvicorn","app.main:app","--reload","--port","8000" `
  -WorkingDirectory "$root\backend"

Start-Sleep -Seconds 3

Write-Host "Starting React frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run","dev" `
  -WorkingDirectory "$root\frontend"

Write-Host ""
Write-Host "EXAM FOCUS is starting up:" -ForegroundColor Green
Write-Host "  Web app : http://localhost:5173"
Write-Host "  API docs: http://localhost:8000/docs"
Write-Host ""
Write-Host "Admin login:"
Write-Host "  esuman82@gmail.com / Bro@1005"
Write-Host ""
Write-Host "New registrations must be approved by the admin before they can log in."
