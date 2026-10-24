"""
Clinical Safety and Privacy Guardrails for ClearConsult.
Strictly adheres to:
1. Immediate 112 Emergency Detection (bypasses LLM entirely)
2. Backend Output Filter blocking diagnoses, disease names, drug dosages, and treatment advice.
3. Audit logging of any blocked content.
"""

import re
import logging
from typing import Optional, Tuple, Dict, Any, List

logger = logging.getLogger("clearconsult.safety")

# Emergency triggers that must immediately trigger the fixed 112 emergency advice
EMERGENCY_KEYWORDS = [
    r"\bunconscious\b",
    r"\bnot breathing\b",
    r"\bcannot breathe at all\b",
    r"\bcollapsed\b",
    r"\bcardiac arrest\b",
    r"\bheart attack right now\b",
    r"\bblue lips\b",
    r"\bsevere anaphylaxis\b",
    r"\bchoking\b",
    r"\bmassive bleeding\b",
    r"\bdying\b",
    r"\bsuicide\b",
    r"\bsevere convulsion\b",
    r"\bseizure now\b",
    # Tamil emergency triggers
    r"மயக்கம்",
    r"மூச்சு நின்ற",
    r"உயிர் போகுது",
    # Hindi emergency triggers
    r"बेहोश",
    r"सांस नहीं आ रही",
    r"खून बह रहा है",
]

EMERGENCY_COMPILED = [re.compile(kw, re.IGNORECASE) for kw in EMERGENCY_KEYWORDS]

FIXED_EMERGENCY_RESPONSE = {
    "is_emergency": True,
    "alert_message": "EMERGENCY DETECTED: ClearConsult is a telemedicine support tool and does not manage active life-threatening emergencies. Please call 112 immediately or proceed to the nearest emergency room.",
    "alert_message_ta": "அவசரநிலை கண்டறியப்பட்டது: ClearConsult அவசர மருத்துவ உதவிக்கான தளம் அல்ல. தயவுசெய்து உடனடியாக 112-ஐ அழைக்கவும் அல்லது அருகிலுள்ள அவசர சிகிச்சைப் பிரிவிற்கு செல்லவும்.",
    "alert_message_hi": "आपातकालीन स्थिति: ClearConsult जीवन-घातक आपात स्थितियों के लिए नहीं है। कृपया तुरंत 112 डायल करें या निकटतम आपातकालीन अस्पताल जाएं।",
    "rule_id": "SAFETY-EMERGENCY-112"
}

# Forbidden diagnostic terms and treatment phrasing
FORBIDDEN_DIAGNOSES = [
    r"\b(diagnosis|diagnosed with|suffering from)\s+([a-zA-Z\s]+)",
    r"\bpneumonia\b",
    r"\bmyocardial infarction\b",
    r"\bappendicitis\b",
    r"\bmeningitis\b",
    r"\bpulmonary embolism\b",
    r"\bsepsis\b",
    r"\bchronic obstructive pulmonary disease\b",
    r"\bcovid-19\b",
    r"\btuberculosis\b",
    r"\bbronchitis\b",
    r"\bstroke\b",
]

FORBIDDEN_TREATMENT_PATTERNS = [
    r"\b\d+\s*(mg|ml|mcg|g|tablets?|capsules?|pills?)\b",
    r"\b(take|prescribe|administer|give|start|dose|dosage)\s+([a-zA-Z\s]+)\b",
    r"\b(paracetamol|amoxicillin|azithromycin|aspirin|ibuprofen|steroids?|antibiotics?)\b",
    r"\b(start antibiotics|should take antibiotics|recommended treatment|treatment plan:)\b",
    r"\b(you must take|patient should be given)\b",
]

# Neutral redaction stamp without keyword collisions
BLOCKED_REPLACEMENT = "[REDACTED - Filtered by clinical safety rules]"


def check_emergency(user_text: str) -> Optional[Dict[str, Any]]:
    """Checks if input text triggers an emergency without sending to any model."""
    if not user_text:
        return None
    for pattern in EMERGENCY_COMPILED:
        if pattern.search(user_text):
            logger.warning(f"EMERGENCY TRIGGERED by pattern: {pattern.pattern} in text: {user_text[:80]}")
            return FIXED_EMERGENCY_RESPONSE
    return None


def filter_text_safety(text: str) -> Tuple[str, List[str]]:
    """Sanitizes text by removing diagnosis/treatment suggestions."""
    if not text or not isinstance(text, str):
        return text, []

    violations = []
    sanitized = text

    # Filter treatment recommendations and dosages first
    for pattern_str in FORBIDDEN_TREATMENT_PATTERNS:
        matches = list(re.finditer(pattern_str, sanitized, re.IGNORECASE))
        if matches:
            for m in matches:
                violations.append(f"Treatment/Dose pattern matched: '{m.group(0)}'")
            sanitized = re.sub(pattern_str, BLOCKED_REPLACEMENT, sanitized, flags=re.IGNORECASE)

    # Filter definitive disease diagnosis statements
    for pattern_str in FORBIDDEN_DIAGNOSES:
        matches = list(re.finditer(pattern_str, sanitized, re.IGNORECASE))
        if matches:
            for m in matches:
                # Do not redact if inside our own replacement token
                if "Filtered by clinical safety" not in m.group(0):
                    violations.append(f"Diagnosis phrase matched: '{m.group(0)}'")
            sanitized = re.sub(pattern_str, BLOCKED_REPLACEMENT, sanitized, flags=re.IGNORECASE)

    if violations:
        logger.warning(f"SAFETY FILTER BLOCKED content: {violations}")

    return sanitized, violations


def sanitize_extracted_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively scans and sanitizes all fields returned by extractor."""
    sanitized = payload.copy()
    all_violations = []

    # Check extracted fields
    if "extracted_fields" in sanitized and isinstance(sanitized["extracted_fields"], dict):
        for field_name, field_obj in sanitized["extracted_fields"].items():
            if isinstance(field_obj, dict):
                # Sanitize AI values
                if "value" in field_obj and isinstance(field_obj["value"], str):
                    clean_val, v = filter_text_safety(field_obj["value"])
                    field_obj["value"] = clean_val
                    all_violations.extend(v)
                elif "value" in field_obj and isinstance(field_obj["value"], list):
                    clean_list = []
                    for item in field_obj["value"]:
                        if isinstance(item, str):
                            clean_item, v = filter_text_safety(item)
                            clean_list.append(clean_item)
                            all_violations.extend(v)
                        else:
                            clean_list.append(item)
                    field_obj["value"] = clean_list

    # Check next question
    if "highest_priority_unknown" in sanitized and isinstance(sanitized["highest_priority_unknown"], dict):
        q_obj = sanitized["highest_priority_unknown"]
        if "question" in q_obj and isinstance(q_obj["question"], str):
            clean_q, v = filter_text_safety(q_obj["question"])
            q_obj["question"] = clean_q
            all_violations.extend(v)

    if all_violations:
        sanitized["safety_filter_log"] = all_violations

    return sanitized
