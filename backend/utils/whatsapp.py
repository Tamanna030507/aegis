"""
WhatsApp alert client using CallMeBot (free, no credit card required).
Activation: save +34 644 60 49 79 on WhatsApp, send "I allow callmebot to send me messages"
You receive your API key by WhatsApp within seconds.
"""
import httpx
from typing import Optional

from backend.utils.logger import get_logger

log = get_logger(__name__)


async def send_whatsapp_alert(message: str, to: Optional[str] = None) -> bool:
    """
    Send WhatsApp message via CallMeBot.
    Falls back to Twilio if CallMeBot not configured.
    Returns True on success. Never raises — demo must not crash.
    """
    import os
    phone  = to or os.getenv("CALLMEBOT_PHONE", "")
    apikey = os.getenv("CALLMEBOT_APIKEY", "")

    # ── Try CallMeBot (free, no credit card) ─────────────────────────────────
    if phone and apikey:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.callmebot.com/whatsapp.php",
                    params={"phone": phone, "text": message, "apikey": apikey},
                )
            if resp.status_code == 200:
                log.info(f"WhatsApp alert sent via CallMeBot to {phone}")
                return True
            else:
                log.warning(f"CallMeBot returned {resp.status_code}: {resp.text[:100]}")
        except Exception as exc:
            log.warning(f"CallMeBot failed: {exc} — trying Twilio fallback")

    # ── Twilio fallback (if configured) ──────────────────────────────────────
    twilio_sid   = os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    twilio_from  = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    twilio_to    = to or os.getenv("TWILIO_WHATSAPP_TO", "")

    if twilio_sid and twilio_token and twilio_to:
        try:
            from twilio.rest import Client
            client = Client(twilio_sid, twilio_token)
            recipient = twilio_to if twilio_to.startswith("whatsapp:") else f"whatsapp:{twilio_to}"
            msg = client.messages.create(body=message, from_=twilio_from, to=recipient)
            log.info(f"WhatsApp alert sent via Twilio: SID={msg.sid}")
            return True
        except Exception as exc:
            log.error(f"Twilio fallback failed: {exc}")

    log.warning("No WhatsApp provider configured — alert skipped")
    return False
