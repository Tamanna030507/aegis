# AEGIS startup script — launches backend + both frontends
# Usage: .\start.ps1
# Requires: Python 3.11+, Node 20+, pip install -r requirements.txt done, npm install done in both frontend dirs
Start-Process "http://localhost:3007"
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " AEGIS — Adaptive Embodied Guardian Intelligence" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ── Backend ──────────────────────────────────────────────────────────────────
Write-Host "[1/3] Starting FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal

Start-Sleep -Seconds 3

# ── Patient App ───────────────────────────────────────────────────────────────
Write-Host "[2/3] Starting Patient App on http://localhost:3005 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\frontend\patient-app'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# ── Physician Dashboard ───────────────────────────────────────────────────────
Write-Host "[3/3] Starting Physician Dashboard on http://localhost:3001 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\frontend\physician-dashboard'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " All services started!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend API:          http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs (Swagger):   http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Patient App:          http://localhost:3005" -ForegroundColor White
Write-Host "  Physician Dashboard:  http://localhost:3001" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Patient 0047 demo data is auto-seeded on first run." -ForegroundColor Yellow
Write-Host "Add your GEMINI_API_KEY to .env to enable live AI features." -ForegroundColor Yellow
