#!/bin/bash

# AEGIS Startup Script for macOS / Linux
# Usage: ./start.sh

# Colors for terminal output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN} AEGIS — Adaptive Embodied Guardian Intelligence  ${NC}"
echo -e "${CYAN}==================================================${NC}"
echo ""

# Function to clean up background processes on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping all services...${NC}"
    kill $BACKEND_PID $LOGIN_PID $PATIENT_PID $PHYSICIAN_PID 2>/dev/null
    exit
}

# Trap Ctrl+C (SIGINT) and exit signals to clean up background processes
trap cleanup INT TERM EXIT

# ── 1. Backend (FastAPI) ─────────────────────────────────────────────────────
echo -e "${GREEN}[1/4] Starting FastAPI Backend on http://localhost:8000 ...${NC}"
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

sleep 3

# ── 2. Login Portal (serve) ──────────────────────────────────────────────
echo -e "${GREEN}[2/4] Starting Login Portal on http://localhost:3007 ...${NC}"
npx serve frontend/login -l 3007 &
LOGIN_PID=$!

sleep 2

# ── 3. Patient App ───────────────────────────────────────────────────────────
echo -e "${GREEN}[3/4] Starting Patient App on http://localhost:3005 ...${NC}"
cd frontend/patient-app
npm run dev -- --port 3005 &
PATIENT_PID=$!
cd ../..

sleep 2

# ── 4. Physician Dashboard ───────────────────────────────────────────────────
echo -e "${GREEN}[4/4] Starting Physician Dashboard on http://localhost:3008 ...${NC}"
cd frontend/physician-dashboard
npm run dev -- --port 3008 &
PHYSICIAN_PID=$!
cd ../..

sleep 3

echo ""
echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN} All services started successfully!              ${NC}"
echo ""
echo -e "  ${YELLOW}Login Portal (Start here): http://localhost:3007${NC}"
echo -e "  Backend API:               http://localhost:8000"
echo -e "  API Docs (Swagger):        http://localhost:8000/docs"
echo -e "  Patient App:               http://localhost:3005"
echo -e "  Physician Dashboard:       http://localhost:3008"
echo -e "${CYAN}==================================================${NC}"
echo -e "Press [Ctrl+C] to stop all services."
echo ""

# Keep script running to maintain background jobs
wait
