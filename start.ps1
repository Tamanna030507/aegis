# AEGIS startup script — launches backend + login + both frontends
# Usage: .\start.ps1

$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " AEGIS — Adaptive Embodied Guardian Intelligence" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Backend (FastAPI) ─────────────────────────────────────────────────────
Write-Host "[1/4] Starting FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload" -WindowStyle Normal

Start-Sleep -Seconds 3

# ── 2. Login Portal (npx serve) ──────────────────────────────────────────────
Write-Host "[2/4] Starting Login Portal on http://localhost:3007 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\frontend\login'; npx serve . -l 3007" -WindowStyle Normal

Start-Sleep -Seconds 2

# ── 3. Patient App ───────────────────────────────────────────────────────────
Write-Host "[3/4] Starting Patient App on http://localhost:3005 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\frontend\patient-app'; npm run dev -- --port 3005" -WindowStyle Normal

Start-Sleep -Seconds 2

# ── 4. Physician Dashboard ───────────────────────────────────────────────────
Write-Host "[4/4] Starting Physician Dashboard on http://localhost:3008 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\frontend\physician-dashboard'; npm run dev -- --port 3008" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " All services started!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login Portal (Start here): http://localhost:3007" -ForegroundColor Yellow
Write-Host "  Backend API:               http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs (Swagger):        http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Patient App:               http://localhost:3005" -ForegroundColor White
Write-Host "  Physician Dashboard:       http://localhost:3008" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Open default entry point
Start-Process "http://localhost:3007"
