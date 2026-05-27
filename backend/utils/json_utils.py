"""Safe JSON extraction from LLM responses."""
import json
import re
from typing import Any

from backend.utils.logger import get_logger

log = get_logger(__name__)


def extract_json(raw: str) -> Any:
    """
    Strips markdown code fences and parses JSON from an LLM response.
    Handles: ```json ... ```, ``` ... ```, and bare JSON.
    Raises json.JSONDecodeError if parsing fails after stripping.
    """
    text = raw.strip()
    # Remove opening fence (```json or ```)
    text = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.IGNORECASE)
    # Remove closing fence
    text = re.sub(r"\n?```\s*$", "", text)
    return json.loads(text.strip())
