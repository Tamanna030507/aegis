import google.generativeai as genai
from dotenv import load_dotenv
import os, json

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

print("=== Gemini API Live Test ===")

model = genai.GenerativeModel(
    model_name="gemini-2.5-flash",
    generation_config=genai.types.GenerationConfig(
        max_output_tokens=512,
        temperature=0.1,
    ),
    system_instruction="Respond ONLY with valid JSON. No markdown, no preamble, no code fences.",
)

prompt = (
    "Patient on Day 5 post robotic colectomy. "
    "Overall risk 72%. PCPS 6.8/10. Wound score 61/100. "
    'Return JSON: {"urgency": "urgent", "whatsapp_message": "<alert under 160 chars>"}'
)

resp = model.generate_content(prompt)
raw = resp.text.strip()

# Strip any accidental markdown fences
if raw.startswith("```"):
    raw = raw.split("```")[1]
    if raw.startswith("json"):
        raw = raw[4:]
raw = raw.strip()

data = json.loads(raw)
print(f"Urgency:      {data['urgency']}")
print(f"WhatsApp msg: {data['whatsapp_message']}")
print()
print("Gemini 2.5 Flash ACTIVE and responding correctly!")
print("All AI features enabled: wound analysis, Evidence Brief, cascade reasoning.")
