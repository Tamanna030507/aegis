"""Health check endpoints — Gemini API status, rate limit, system readiness."""
from fastapi import APIRouter
import google.generativeai as genai
from backend.config import GEMINI_MODEL

router = APIRouter()


@router.get("/health/ai")
async def ai_health():
    """Check Gemini API connectivity — goes through rate limiter so no quota is silently burned."""
    from backend.utils.gemini_rate import acquire as gemini_acquire, calls_in_last_minute, RATE_LIMIT

    calls    = calls_in_last_minute()
    gemini_ok = False

    if gemini_acquire():   # track this call in the rate limiter
        try:
            model = genai.GenerativeModel(GEMINI_MODEL)
            resp  = model.generate_content("Reply with exactly: ok")
            gemini_ok = "ok" in resp.text.lower()
        except Exception:
            gemini_ok = False
    else:
        gemini_ok = None  # rate limited — can't verify right now

    return {
        "gemini_ok":          gemini_ok,
        "gemini_model":       GEMINI_MODEL,
        "calls_last_minute":  calls,
        "rate_limit_per_min": RATE_LIMIT,
        "rate_limit_safe":    calls < RATE_LIMIT - 3,
        "note":               "null = rate limited (not an error)" if gemini_ok is None else None,
    }


@router.get("/health")
def health():
    """Basic liveness check — no external calls."""
    return {"status": "ok", "service": "AEGIS Backend"}
