"""Test Twilio WhatsApp alert — sends a real message to the configured number."""
from dotenv import load_dotenv
import os

load_dotenv()

from twilio.rest import Client

sid   = os.getenv("TWILIO_ACCOUNT_SID")
token = os.getenv("TWILIO_AUTH_TOKEN")
frm   = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
to    = os.getenv("TWILIO_WHATSAPP_TO")

print(f"Account SID : {sid[:10]}...{sid[-4:]}")
print(f"From        : {frm}")
print(f"To          : {to}")
print()

client = Client(sid, token)

msg = client.messages.create(
    from_=frm,
    to=to,
    body=(
        "AEGIS ALERT: Patient 0047 - HIGH RISK (72%). "
        "Wound score 61/100 declining. PCPS 6.8/10. "
        "Cascade model: 64% seroma risk by Day 6. "
        "Review Evidence Brief in dashboard: http://localhost:3001"
    ),
)

print(f"Message SID : {msg.sid}")
print(f"Status      : {msg.status}")
print()
print("WhatsApp alert SENT to +919927264021")
print("Check your phone now!")
