"""
AEGIS FastAPI Application Entry Point.
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import CORS_ORIGINS
from backend.database import init_db
from backend.utils.logger import get_logger

# ── Import routers ─────────────────────────────────────────────────────────────
from backend.api import patients, checkins, risk, passport, robot, alerts, health as health_api
from backend.api import ws as ws_router

log = get_logger("aegis.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("AEGIS starting up...")
    init_db()
    await _seed_demo_data_if_empty()
    log.info("AEGIS ready. Docs: http://localhost:8000/docs")
    yield
    log.info("AEGIS shutting down.")


async def _seed_demo_data_if_empty():
    from backend.database import SessionLocal
    from backend.models.patient import Patient
    db = SessionLocal()
    try:
        count = db.query(Patient).count()
        if count == 0:
            log.info("Database empty — seeding Patient 47 demo data...")
            from scripts.seed_demo import seed_patient_0047
            await seed_patient_0047(db)
            log.info("Patient 47 seeded successfully.")
    except Exception as e:
        log.error(f"Demo seeding failed (non-fatal): {e}")
    finally:
        db.close()


app = FastAPI(
    title="AEGIS — Adaptive Embodied Guardian Intelligence System",
    description="Surgical continuity intelligence platform for the 2026 SmartEarth Hackathon.",
    version="0.1.0-demo",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
os.makedirs("static/qr", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(patients.router, prefix="/api/patients", tags=["patients"])
app.include_router(checkins.router, prefix="/api/checkins", tags=["checkins"])
app.include_router(risk.router,     prefix="/api/risk",     tags=["risk"])
app.include_router(passport.router, prefix="/api/passport", tags=["passport"])
app.include_router(robot.router,    prefix="/api/robot",    tags=["robot"])
app.include_router(alerts.router,   prefix="/api/alerts",   tags=["alerts"])
app.include_router(health_api.router,                        tags=["health"])
app.include_router(ws_router.router,                         tags=["websocket"])


@app.get("/health")
def health():
    return {"status": "ok", "system": "AEGIS", "version": "0.1.0-demo"}