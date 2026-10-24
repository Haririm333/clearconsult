"""
Deterministic Rule Engine for ClearConsult.
Strict Principle: The LLM extracts and phrases; ONLY the rule engine can raise Needs attention.
No LLM hallucinations can generate medical alerts.
"""

import json
import os
import re
from typing import List, Dict, Any, Optional

RULES_PATH = os.path.join(os.path.dirname(__file__), "..", "rules", "red_flags.json")


def load_rules() -> List[Dict[str, Any]]:
    if not os.path.exists(RULES_PATH):
        return []
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _text_matches_any(target_text: str, keywords: List[str]) -> bool:
    target = target_text.lower()
    for kw in keywords:
        if kw.lower() in target:
            return True
    return False


def _parse_duration_days(duration_str: Optional[str]) -> Optional[int]:
    if not duration_str:
        return None
    d_str = duration_str.lower()
    # Check for days
    match_days = re.search(r"(\d+)\s*(day|days|d|நாள்|நாட்கள்|दिन)", d_str)
    if match_days:
        return int(match_days.group(1))
    # Check for weeks
    match_weeks = re.search(r"(\d+)\s*(week|weeks|w|வாரம்|हफ्ते|सप्ताह)", d_str)
    if match_weeks:
        return int(match_weeks.group(1)) * 7
    return None


def _parse_severity(severity_field: Dict[str, Any]) -> Optional[int]:
    if not severity_field:
        return None
    if severity_field.get("numeric_scale") is not None:
        try:
            return int(severity_field["numeric_scale"])
        except (ValueError, TypeError):
            pass
    val = str(severity_field.get("value") or "")
    match = re.search(r"(\d+)\s*(?:/|out of|\b)", val)
    if match:
        try:
            num = int(match.group(1))
            if 0 <= num <= 10:
                return num
        except (ValueError, TypeError):
            pass
    # Qualitative check
    if any(w in val.lower() for w in ["severe", "கடுமையான", "மிகவும் அதிகம்", "बहुत तेज", "गंभीर"]):
        return 8
    return None


class RuleEngine:
    def __init__(self, rules_file: Optional[str] = None):
        self.rules_file = rules_file or RULES_PATH
        self.rules = self._load()

    def _load(self) -> List[Dict[str, Any]]:
        if os.path.exists(self.rules_file):
            with open(self.rules_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def evaluate(
        self,
        extracted_fields: Dict[str, Any],
        raw_text: str = "",
        measured_vitals: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Runs deterministic logic against extracted fields and raw conversation text.
        Returns a list of triggered Needs Attention alerts with Rule ID.
        """
        alerts = []
        triggered_ids = set()

        # Build corpus of patient reported terms
        reported_terms = []
        
        # chief complaint
        cc = extracted_fields.get("chief_complaint", {})
        if cc.get("status") == "known" and cc.get("value"):
            reported_terms.append(str(cc.get("value")))
        if cc.get("evidence"):
            reported_terms.append(str(cc.get("evidence")))

        # associated symptoms
        assoc = extracted_fields.get("associated_symptoms", {})
        if assoc.get("status") == "known" and assoc.get("value"):
            if isinstance(assoc["value"], list):
                reported_terms.extend([str(x) for x in assoc["value"]])
            else:
                reported_terms.append(str(assoc["value"]))
        if assoc.get("evidence"):
            reported_terms.append(str(assoc.get("evidence")))

        # onset
        onset_val = str(extracted_fields.get("onset", {}).get("value") or "")
        onset_evidence = str(extracted_fields.get("onset", {}).get("evidence") or "")
        onset_corpus = f"{onset_val} {onset_evidence}".lower()

        # duration
        duration_val = str(extracted_fields.get("duration", {}).get("value") or "")
        duration_evidence = str(extracted_fields.get("duration", {}).get("evidence") or "")
        duration_corpus = f"{duration_val} {duration_evidence}".lower()
        duration_days = _parse_duration_days(duration_corpus)

        # severity
        severity_obj = extracted_fields.get("severity", {})
        severity_score = _parse_severity(severity_obj)

        corpus_text = f"{raw_text} {' '.join(reported_terms)}".lower()

        for rule in self.rules:
            rule_id = rule["id"]
            if rule_id in triggered_ids:
                continue

            cond = rule.get("conditions", {})
            matched = False

            # Condition: any_symptoms
            any_symptoms = cond.get("any_symptoms", [])
            has_primary_symptom = _text_matches_any(corpus_text, any_symptoms) if any_symptoms else True

            if has_primary_symptom:
                # Sub-check: and_symptoms (co-occurrence)
                and_symptoms = cond.get("and_symptoms", [])
                if and_symptoms:
                    has_and_symptom = _text_matches_any(corpus_text, and_symptoms)
                    if has_and_symptom:
                        matched = True
                
                # Sub-check: min_severity
                min_sev = cond.get("min_severity")
                if min_sev is not None:
                    # check if severity >= min_sev or keywords like severe/கடுமையான in conjunction with symptom
                    if severity_score is not None and severity_score >= min_sev:
                        matched = True
                    elif any(w in corpus_text for w in ["severe", "கடுமையான", "बहुत तेज़", "तीव्र"]):
                        matched = True

                # Sub-check: onset keywords
                onset_kws = cond.get("onset_keywords", [])
                if onset_kws:
                    if _text_matches_any(onset_corpus, onset_kws) or _text_matches_any(corpus_text, onset_kws):
                        matched = True

                # Sub-check: min_duration_days
                min_days = cond.get("min_duration_days")
                if min_days is not None:
                    if duration_days is not None and duration_days >= min_days:
                        matched = True

                # Sub-check: flag_type for mismatch or unconfirmed (Phase 4)
                if cond.get("flag_type") == "mismatch_or_unconfirmed" and measured_vitals:
                    conf = measured_vitals.get("confidence", "low")
                    rate = measured_vitals.get("breathing_rate")
                    if conf == "low" or (rate and 12 <= rate <= 20 and severity_score and severity_score >= 7):
                        matched = True

                # Simple symptom rule match if no extra conditions specified
                if not and_symptoms and min_sev is None and not onset_kws and min_days is None and cond.get("flag_type") is None:
                    matched = True

            if matched:
                triggered_ids.add(rule_id)
                alerts.append({
                    "id": rule["id"],
                    "name": rule.get("name", rule["id"]),
                    "message": rule["message"],
                    "source": rule.get("source", "DRAFT - requires clinician review"),
                    "severity_level": rule.get("severity_level", "warning")
                })

        return alerts
