"""
Wound Analysis Agent — Gemini multimodal vision.
Analyzes wound images and returns structured WoundAnalysis.
Falls back to honest _UNAVAILABLE state (not fake data) when AI is down.
"""
import json
from typing import Optional

import google.generativeai as genai
from pydantic import BaseModel

from backend.config import GEMINI_MODEL, MAX_OUTPUT_TOKENS
from backend.utils.logger import get_logger
from backend.utils.json_utils import extract_json
from backend.utils.gemini_rate import acquire as gemini_acquire

log = get_logger(__name__)

SYSTEM_PROMPT = """You are a clinical wound assessment AI assistant.
Analyze the provided post-surgical wound image and respond ONLY with valid JSON matching this exact schema.
No preamble, no explanation, no markdown code fences.

Schema:
{
  "wound_score": <integer 0-100, where 100=perfect healing, 0=severe deterioration>,
  "healing_stage": "<epithelialization|proliferation|inflammation|necrosis>",
  "infection_probability": <float 0.0-1.0>,
  "redness_score": <integer 0-10>,
  "swelling_score": <integer 0-10>,
  "dehiscence_risk": <float 0.0-1.0>,
  "flags": <list of strings, e.g. ["redness_spreading", "discharge_present"]>,
  "clinical_notes": "<one-sentence clinical observation>",
  "data_quality": "good"
}"""


class WoundAnalysis(BaseModel):
    wound_score: Optional[int]             = None
    healing_stage: str                      = "unknown"
    infection_probability: Optional[float] = None
    redness_score: Optional[int]           = None
    swelling_score: Optional[int]          = None
    dehiscence_risk: Optional[float]       = None
    flags: list[str]                        = []
    clinical_notes: str                     = ""
    data_quality: str                       = "good"


# Honest unavailable — no fake numbers, physician told to assess manually
_UNAVAILABLE = WoundAnalysis(
    wound_score=None,
    healing_stage="unavailable",
    infection_probability=None,
    redness_score=None,
    swelling_score=None,
    dehiscence_risk=None,
    flags=["vision_analysis_unavailable"],
    clinical_notes="Gemini vision unavailable. Manual wound assessment required at next teleconsult.",
    data_quality="unavailable",
)


async def analyze_wound(image_bytes: bytes, mime_type: str = "image/jpeg") -> WoundAnalysis:
    """
    Call Gemini with wound image bytes.
    Returns WoundAnalysis. Falls back to _UNAVAILABLE on failure — never crashes.
    """
    if not gemini_acquire():
        log.warning("Gemini rate limited — wound analysis unavailable")
        return _UNAVAILABLE

    try:
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=MAX_OUTPUT_TOKENS,
                temperature=0.1,
            ),
            system_instruction=SYSTEM_PROMPT,
        )

        image_part = {"mime_type": mime_type, "data": image_bytes}
        response = model.generate_content(
            [image_part, "Analyze this post-surgical wound image."]
        )

        data = extract_json(response.text)
        data["wound_score"] = max(0, min(100, int(data.get("wound_score", 50))))
        data["data_quality"] = data.get("data_quality", "good")

        log.info(f"Wound analysis: score={data['wound_score']} infection_p={data.get('infection_probability', '?')}")
        return WoundAnalysis(**data)

    except Exception as exc:
        log.error(f"Wound agent failed: {exc}")
        return _UNAVAILABLE
