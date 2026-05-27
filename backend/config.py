import logging
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
_log = logging.getLogger("aegis.config")

# ── LLM ──────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    _log.warning("GEMINI_API_KEY not set — AI features will use fallback mode. Get key: aistudio.google.com")
else:
    genai.configure(api_key=GEMINI_API_KEY)

# gemini-2.5-flash confirmed available on this API key
GEMINI_MODEL    = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
MAX_OUTPUT_TOKENS = 1024

# ── Alerts — CallMeBot (free WhatsApp, no credit card) ───────────────────────
# Setup: save +34 644 60 49 79 on WhatsApp, send "I allow callmebot to send me messages"
CALLMEBOT_PHONE  = os.getenv("CALLMEBOT_PHONE", "")
CALLMEBOT_APIKEY = os.getenv("CALLMEBOT_APIKEY", "")

# ── Twilio fallback (kept for backwards compat) ───────────────────────────────
TWILIO_ACCOUNT_SID   = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN    = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
TWILIO_WHATSAPP_TO   = os.getenv("TWILIO_WHATSAPP_TO", "")

# ── Passport signing ──────────────────────────────────────────────────────────
AEGIS_ECDSA_PRIVATE_KEY = os.getenv("AEGIS_ECDSA_PRIVATE_KEY", "")
AEGIS_ECDSA_PUBLIC_KEY  = os.getenv("AEGIS_ECDSA_PUBLIC_KEY", "")

# ── App ───────────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aegis.db")
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3008,http://localhost:3002,http://localhost:3005",
).split(",")
AEGIS_NODE_ID            = os.getenv("AEGIS_NODE_ID", "AEGIS-DEMO-NODE-01")
FEDERATED_SIMULATION_MODE = os.getenv("FEDERATED_SIMULATION_MODE", "true").lower() == "true"

# ── Risk thresholds ───────────────────────────────────────────────────────────
ESCALATION_RISK_THRESHOLD = float(os.getenv("ESCALATION_RISK_THRESHOLD", "0.65"))
CASCADE_ALERT_PROBABILITY  = float(os.getenv("CASCADE_ALERT_PROBABILITY", "0.60"))
