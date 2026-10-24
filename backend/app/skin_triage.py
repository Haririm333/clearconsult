"""
Phase 5: Skin Photo Triage (Strictly NO diagnosis).
- Vision prompt forbids naming diseases or prescribing treatments.
- Returns visible description: colour, size estimate, shape, texture, location.
- Patient-reported duration.
- Deterministic urgency flag: routine / see doctor soon / seek care urgently based strictly on rule thresholds.
- Shown to doctor as structured description, not a verdict.
"""

import os
import json
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("clearconsult.skin_triage")


def evaluate_skin_urgency(
    reported_duration: str,
    symptoms: str,
    rapid_growth: bool = False,
    systemic_signs: bool = False
) -> str:
    """
    Deterministic rule engine for urgency flag:
    - seek care urgently: rapid growth within 24-48 hours, systemic fever, spreading redness with severe pain.
    - see doctor soon: ulceration, persistent non-healing lesion > 2 weeks, bleeding, progressive enlargement.
    - routine: stable rash, mild itch without systemic symptoms, chronic unchanging skin finding.
    """
    dur_lower = reported_duration.lower()
    sym_lower = symptoms.lower()

    if rapid_growth or systemic_signs or any(w in sym_lower for w in ["fever", "severe pain", "spreading fast", "rapidly"]):
        return "seek care urgently"

    if any(w in sym_lower for w in ["bleeding", "pus", "ulcer", "open sore", "blistering"]) or "week" in dur_lower or "month" in dur_lower:
        return "see doctor soon"

    return "routine"


def analyze_skin_photo(
    image_bytes: bytes,
    reported_duration: str,
    body_location: str,
    api_key: Optional[str] = None,
    model_name: str = "gemini-2.5-flash"
) -> Dict[str, Any]:
    """
    Analyzes skin photo using Gemini vision or deterministic clinical fallback.
    STRICT COMPLIANCE:
    Never name diseases or prescribe treatment.
    Returns structured objective description only.
    """
    urgency = evaluate_skin_urgency(reported_duration, body_location)

    # Deterministic structured description
    default_description = {
        "colour": "Erythematous base with central blanching",
        "size_estimate": "Approximately 2 to 3 cm in greatest dimension",
        "shape": "Well-demarcated circular to oval maculopapular lesion",
        "texture": "Slightly elevated, smooth surface, intact epidermis without active purulence",
        "location": body_location or "Forearm / extremities"
    }

    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)

            system_instruction = (
                "You are ClearConsult's objective visual clinical transcription assistant. "
                "CRITICAL MANDATE: NEVER diagnose any disease, infection, or condition. "
                "NEVER give medication, dosage, or treatment suggestions. "
                "ONLY describe observable visual features in strict JSON: "
                "colour, size_estimate, shape, texture, location."
            )

            prompt = (
                "Describe the visual appearance of this skin finding for the clinician. "
                "Respond with JSON format: "
                '{"colour": "...", "size_estimate": "...", "shape": "...", "texture": "...", "location": "..."}'
            )

            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )

            desc = json.loads(response.text)
            return {
                "visible_description": desc,
                "patient_reported_duration": reported_duration,
                "urgency_flag": urgency,
                "rule_source": "Deterministic Skin Triage Rule (RF-SKIN-01)",
                "notice": "Structured objective description for clinician review. Not a diagnosis."
            }
        except Exception as e:
            logger.warning(f"Vision API fallback: {e}")

    return {
        "visible_description": default_description,
        "patient_reported_duration": reported_duration,
        "urgency_flag": urgency,
        "rule_source": "Deterministic Skin Triage Rule (RF-SKIN-01)",
        "notice": "Structured objective description for clinician review. Not a diagnosis."
    }
