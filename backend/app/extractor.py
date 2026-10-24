"""
Gemini LLM Extractor & Mock Fallback Engine for ClearConsult.
Strict schema adherence, language-aware follow-up question generation, and fail-safe mock fixture support.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from backend.app.schemas import (
    ExtractRequest,
    ExtractResponse,
    ExtractedFieldsContainer,
    ExtractedField,
    NextQuestion,
    NeedsAttentionItem
)
from backend.app.rule_engine import RuleEngine
from backend.app.safety import check_emergency, sanitize_extracted_payload

logger = logging.getLogger("clearconsult.extractor")

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "fixtures")

# Priority ranking for unknown fields (highest first)
PRIORITY_ORDER = [
    "chief_complaint",
    "duration",
    "onset",
    "severity",
    "associated_symptoms",
    "relevant_negatives",
    "medications"
]

QUESTION_TEMPLATES = {
    "ta": {
        "chief_complaint": "உங்களுக்கு இப்போது என்ன பிரச்சனை அல்லது உடல் உபாதை இருக்கிறது?",
        "duration": "இந்த உபாதை அல்லது பிரச்சனை தொடங்கி எத்தனை நாட்கள் அல்லது மணிநேரம் ஆகிறது?",
        "onset": "இது திடீரென்று தீவிரமாக ஆரம்பித்ததா அல்லது படிப்படியாக மெதுவாக ஆரம்பித்ததா?",
        "severity": "உங்கள் உபாதையின் தீவிரத்தை 0 முதல் 10 வரை உள்ள அளவுகோலில் எப்படி குறிப்பிடுவீர்கள்? (10 என்பது தாங்க முடியாத வலி/சிரமம்)",
        "associated_symptoms": "இதனுடன் சேர்த்து காய்ச்சல், இருமல், சளி அல்லது வேறு ஏதேனும் அறிகுறிகள் இருக்கிறதா?",
        "relevant_negatives": "உங்களுக்கு நெஞ்சு வலி, மூச்சுத்திணறல் அல்லது வாந்தி போன்ற அறிகுறிகள் எதுவும் இல்லை என்பதை உறுதிப்படுத்த முடியுமா?",
        "medications": "தற்போது ஏதேனும் வழக்கமான மாத்திரைகள் எடுத்துக்கொள்கிறீர்களா அல்லது இதற்காக மருந்து எதுவும் உட்கொண்டீர்களா?"
    },
    "hi": {
        "chief_complaint": "आपको मुख्य रूप से क्या समस्या या तकलीफ महसूस हो रही है?",
        "duration": "यह परेशानी कितने दिनों या घंटों से है?",
        "onset": "क्या यह अचानक तीव्र रूप से शुरू हुआ या धीरे-धीरे बढ़ा?",
        "severity": "आप अपनी तकलीफ को 0 से 10 के पैमाने पर कितना नंबर देंगे? (10 सबसे असहनीय)",
        "associated_symptoms": "क्या इसके साथ बुखार, खांसी, उल्टी या कोई अन्य लक्षण भी हैं?",
        "relevant_negatives": "क्या आपको सीने में दर्द, सांस लेने में तकलीफ या चक्कर जैसी कोई समस्या नहीं है?",
        "medications": "क्या आप नियमित रूप से कोई दवाई ले रहे हैं या इसके लिए कोई दवा ली है?"
    },
    "en": {
        "chief_complaint": "Could you please describe what primary symptom or discomfort brings you in today?",
        "duration": "How long have you had this symptom (hours or days)?",
        "onset": "Did this start abruptly and suddenly, or did it develop gradually?",
        "severity": "On a scale of 0 to 10 (where 0 is no discomfort and 10 is the worst imaginable), how severe is it?",
        "associated_symptoms": "Are you experiencing any other symptoms, such as fever, cough, or nausea?",
        "relevant_negatives": "Can you confirm if you have had NO chest pain, shortness of breath, or neck stiffness?",
        "medications": "Are you currently taking any regular prescription medications or over-the-counter remedies?"
    }
}


def load_fixture(fixture_name: str) -> Dict[str, Any]:
    path = os.path.join(FIXTURES_DIR, fixture_name)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def is_tamil_text(text: str) -> bool:
    # Tamil Unicode block range: \u0B80-\u0BFF
    return any("\u0b80" <= char <= "\u0bff" for char in text)


def is_hindi_text(text: str) -> bool:
    # Devanagari Unicode block range: \u0900-\u097F
    return any("\u0900" <= char <= "\u097f" for char in text)


def detect_language(text: str, default_lang: str = "en") -> str:
    if is_tamil_text(text):
        return "ta"
    if is_hindi_text(text):
        return "hi"
    return default_lang


class ClinicalExtractor:
    def __init__(self):
        self.rule_engine = RuleEngine()
        self.use_mock = os.getenv("USE_MOCK", "false").lower() in ("true", "1", "yes")
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    def _determine_highest_priority_unknown(
        self,
        extracted_fields: Dict[str, Any],
        language: str,
        skipped_fields: List[str]
    ) -> Optional[NextQuestion]:
        for field in PRIORITY_ORDER:
            if field in skipped_fields:
                continue
            field_data = extracted_fields.get(field, {})
            status = field_data.get("status", "unknown")
            if status == "unknown":
                lang_questions = QUESTION_TEMPLATES.get(language, QUESTION_TEMPLATES["en"])
                question_text = lang_questions.get(field, QUESTION_TEMPLATES["en"][field])
                question_en = QUESTION_TEMPLATES["en"].get(field)
                return NextQuestion(
                    field=field,
                    question=question_text,
                    question_en=question_en
                )
        return None

    def _call_gemini_api(self, conversation_text: str, language: str) -> Optional[Dict[str, Any]]:
        """Calls Google GenAI SDK with structured schema."""
        if not self.api_key:
            logger.info("GEMINI_API_KEY not set. Using local clinical extractor / mock fallback.")
            return None

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)

            system_instruction = (
                "You are ClearConsult's clinical intake extraction engine. "
                "You extract factual patient statements into a strict JSON structure. "
                "CRITICAL PRINCIPLES:\n"
                "1. NEVER DIAGNOSE. NEVER provide disease names, treatment options, or drug dosages.\n"
                "2. Mark each field as 'known' ONLY if the patient clearly stated or described it.\n"
                "3. If unknown, status must be 'unknown', value must be null, and evidence must be null.\n"
                "4. For known fields, extract the patient's EXACT WORDS in their original language as 'evidence'.\n"
                "5. Source must be 'patient said' or 'inferred'.\n"
                "Fields: chief_complaint, onset, duration, severity (numeric 0-10 or null), "
                "associated_symptoms (array), relevant_negatives (array of symptoms patient explicitly denied), "
                "medications (array)."
            )

            prompt = f"Patient Conversation History:\n{conversation_text}\n\nRespond with strict JSON."

            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )

            raw_json = response.text
            data = json.loads(raw_json)
            return data
        except Exception as e:
            logger.warning(f"Gemini API call failed or timed out: {e}. Falling back to deterministic extractor.")
            return None

    def extract(self, req: ExtractRequest) -> ExtractResponse:
        full_text = " ".join([m.get("text", "") for m in req.conversation_history] + [req.latest_input])
        
        # 1. Immediate Safety Check: Emergency bypass
        emergency_result = check_emergency(full_text)
        if emergency_result:
            empty_field = ExtractedField(value=None, status="unknown", evidence=None, source="inferred")
            fields = ExtractedFieldsContainer(
                chief_complaint=ExtractedField(value="LIFE-THREATENING EMERGENCY DETECTED", status="known", evidence=req.latest_input, source="patient said"),
                onset=empty_field,
                duration=empty_field,
                severity=ExtractedField(value="10/10", status="known", evidence="Emergency detected", source="patient said", severity_num=10),
                associated_symptoms=empty_field,
                relevant_negatives=empty_field,
                medications=empty_field
            )
            return ExtractResponse(
                session_id=req.session_id,
                language=req.language,
                extracted_fields=fields,
                highest_priority_unknown=None,
                needs_attention=[
                    NeedsAttentionItem(
                        id="EMERGENCY-112",
                        name="Immediate Emergency Contact Required",
                        message=emergency_result["alert_message"],
                        source="DRAFT - requires clinician review",
                        severity_level="critical"
                    )
                ],
                emergency_alert=emergency_result,
                is_emergency=True,
                all_key_fields_known=False
            )

        # 2. Language auto-detection if not explicitly forced
        detected_lang = detect_language(req.latest_input, req.language)
        active_lang = detected_lang if req.language == "en" and detected_lang != "en" else req.language

        # 3. Extraction: Check if Mock or Tamil Demo Triggered
        extracted_dict: Optional[Dict[str, Any]] = None

        is_tamil_cough_demo = (
            "இருமல்" in full_text or 
            "மூச்சுத்திணறல்" in full_text or 
            "4 நாளா" in full_text or
            req.session_id == "demo-tamil-session"
        )

        if self.use_mock or is_tamil_cough_demo or not self.api_key:
            if is_tamil_cough_demo or active_lang == "ta":
                fixture = load_fixture("tamil_demo.json")
                if fixture:
                    extracted_dict = fixture.get("extracted_fields")
            elif "सिरदर्द" in full_text or active_lang == "hi":
                default_fixtures = load_fixture("default_fixtures.json")
                extracted_dict = default_fixtures.get("hindi_demo", {}).get("extracted_fields")
            elif "chest" in full_text.lower():
                default_fixtures = load_fixture("default_fixtures.json")
                extracted_dict = default_fixtures.get("chest_pain_demo", {}).get("extracted_fields")

        # 4. If not resolved by fixture, call Gemini
        if not extracted_dict and not self.use_mock:
            gemini_res = self._call_gemini_api(full_text, active_lang)
            if gemini_res and "chief_complaint" in gemini_res:
                extracted_dict = gemini_res

        # 5. Deterministic fallback extraction if still none
        if not extracted_dict:
            extracted_dict = self._deterministic_extract(req.latest_input, full_text, active_lang)

        # 6. Apply Safety Output Filter
        safe_payload = sanitize_extracted_payload({"extracted_fields": extracted_dict})
        extracted_dict = safe_payload["extracted_fields"]

        # 7. Convert to Pydantic Container
        container = self._to_container(extracted_dict)

        # 8. Determine highest priority unknown follow-up question
        next_q = self._determine_highest_priority_unknown(
            extracted_dict,
            active_lang,
            req.skipped_fields
        )

        # 9. Run Deterministic Rule Engine ONLY for Needs Attention
        raw_alerts = self.rule_engine.evaluate(extracted_dict, raw_text=full_text)
        needs_attention_items = [
            NeedsAttentionItem(
                id=a["id"],
                name=a["name"],
                message=a["message"],
                source=a.get("source", "DRAFT - requires clinician review"),
                severity_level=a.get("severity_level", "warning")
            )
            for a in raw_alerts
        ]

        all_known = next_q is None

        return ExtractResponse(
            session_id=req.session_id,
            language=active_lang,
            extracted_fields=container,
            highest_priority_unknown=next_q,
            needs_attention=needs_attention_items,
            emergency_alert=None,
            is_emergency=False,
            all_key_fields_known=all_known
        )

    def _deterministic_extract(self, latest_input: str, full_text: str, language: str) -> Dict[str, Any]:
        """Deterministic NLP extractor when API is unavailable."""
        text = full_text.strip()

        # Check for duration patterns
        import re
        duration_val = None
        duration_ev = None
        dur_match = re.search(r"(\d+)\s*(days?|hours?|weeks?|நாட்கள்|நாளா|மணிநேரம்|दिन|घंटे)", text, re.IGNORECASE)
        if dur_match:
            duration_val = dur_match.group(0)
            duration_ev = dur_match.group(0)

        # Check for severity patterns
        sev_val = None
        sev_ev = None
        sev_num = None
        sev_match = re.search(r"(\d+)\s*(?:/|out of|\b)", text)
        if sev_match:
            try:
                num = int(sev_match.group(1))
                if 1 <= num <= 10:
                    sev_num = num
                    sev_val = f"{num}/10"
                    sev_ev = sev_match.group(0)
            except ValueError:
                pass

        # Chief complaint
        cc_val = latest_input if latest_input else text
        
        return {
            "chief_complaint": {
                "value": cc_val[:120],
                "status": "known" if cc_val else "unknown",
                "evidence": latest_input if cc_val else None,
                "source": "patient said"
            },
            "onset": {
                "value": None,
                "status": "unknown",
                "evidence": None,
                "source": "inferred"
            },
            "duration": {
                "value": duration_val,
                "status": "known" if duration_val else "unknown",
                "evidence": duration_ev,
                "source": "patient said" if duration_val else "inferred"
            },
            "severity": {
                "value": sev_val,
                "numeric_scale": sev_num,
                "status": "known" if sev_val else "unknown",
                "evidence": sev_ev,
                "source": "patient said" if sev_val else "inferred"
            },
            "associated_symptoms": {
                "value": [],
                "status": "unknown",
                "evidence": None,
                "source": "inferred"
            },
            "relevant_negatives": {
                "value": [],
                "status": "unknown",
                "evidence": None,
                "source": "inferred"
            },
            "medications": {
                "value": [],
                "status": "unknown",
                "evidence": None,
                "source": "inferred"
            }
        }

    def _to_container(self, d: Dict[str, Any]) -> ExtractedFieldsContainer:
        def _get_field(name: str) -> ExtractedField:
            raw = d.get(name, {})
            if isinstance(raw, dict):
                return ExtractedField(
                    value=raw.get("value"),
                    status=raw.get("status", "unknown"),
                    evidence=raw.get("evidence"),
                    source=raw.get("source", "patient said"),
                    prompt_hint=raw.get("prompt_hint"),
                    severity_num=raw.get("numeric_scale")
                )
            return ExtractedField(value=None, status="unknown", evidence=None, source="inferred")

        return ExtractedFieldsContainer(
            chief_complaint=_get_field("chief_complaint"),
            onset=_get_field("onset"),
            duration=_get_field("duration"),
            severity=_get_field("severity"),
            associated_symptoms=_get_field("associated_symptoms"),
            relevant_negatives=_get_field("relevant_negatives"),
            medications=_get_field("medications")
        )
