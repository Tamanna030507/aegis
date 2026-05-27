"""Live test — calls escalate endpoint and prints Gemini Evidence Brief."""
import urllib.request, json

req = urllib.request.Request("http://localhost:8000/api/alerts/escalate/0047", method="POST")
req.add_header("Content-Type", "application/json")

print("Calling escalation endpoint (Gemini 2.5 Flash generating Evidence Brief)...")

with urllib.request.urlopen(req, timeout=90) as r:
    data = json.loads(r.read())

brief = data.get("brief", {})
print()
print("=== LIVE Evidence Brief from Gemini 2.5 Flash ===")
print(f"Title:   {brief.get('title')}")
print(f"Urgency: {brief.get('urgency')}")
print(f"Action:  {brief.get('recommended_action')}")
print(f"Signals: {len(brief.get('key_signals', []))} key signals")
print(f"Quality: {brief.get('data_quality')}")
print()
print("Key signals:")
for s in brief.get("key_signals", []):
    print(f"  - {s}")
print()
print(f"WhatsApp: {brief.get('whatsapp_message')}")
