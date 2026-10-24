import pytest
import os
import json
from backend.app.rule_engine import RuleEngine
from backend.app.safety import check_emergency, filter_text_safety, sanitize_extracted_payload
from backend.app.extractor import ClinicalExtractor
from backend.app.schemas import ExtractRequest


@pytest.fixture
def rule_engine():
    return RuleEngine()


@pytest.fixture
def extractor():
    return ClinicalExtractor()


def test_rule_rf01_chest_pain_and_breathlessness(rule_engine):
    """RF-01 must trigger when both chest pain and breathlessness are reported."""
    extracted = {
        "chief_complaint": {"value": "Chest tightness", "status": "known", "evidence": "chest tightness"},
        "associated_symptoms": {"value": ["shortness of breath"], "status": "known", "evidence": "short of breath"}
    }
    alerts = rule_engine.evaluate(extracted)
    alert_ids = [a["id"] for a in alerts]
    assert "RF-01" in alert_ids
    rf01 = next(a for a in alerts if a["id"] == "RF-01")
    assert rf01["source"] == "DRAFT - requires clinician review"


def test_rule_rf02_tamil_severe_breathlessness(rule_engine):
    """RF-02 must trigger on severe breathlessness in Tamil text."""
    extracted = {
        "chief_complaint": {"value": "இருமல்", "status": "known", "evidence": "இருமல்"},
        "associated_symptoms": {"value": ["மூச்சுத்திணறல்"], "status": "known", "evidence": "மூச்சுத்திணறலும் இருக்கு"},
        "severity": {"value": "கடுமையான", "status": "known", "evidence": "கடுமையான"}
    }
    tamil_raw = "எனக்கு 4 நாளா கடுமையான இருமலும் மூச்சுத்திணறலும் இருக்கு"
    alerts = rule_engine.evaluate(extracted, raw_text=tamil_raw)
    alert_ids = [a["id"] for a in alerts]
    assert "RF-02" in alert_ids


def test_rule_rf03_sudden_severe_headache(rule_engine):
    """RF-03 must trigger for sudden onset severe headache."""
    extracted = {
        "chief_complaint": {"value": "Severe headache", "status": "known", "evidence": "headache"},
        "onset": {"value": "Sudden thunderclap onset", "status": "known", "evidence": "thunderclap"},
        "severity": {"value": "9/10", "numeric_scale": 9, "status": "known", "evidence": "9/10"}
    }
    alerts = rule_engine.evaluate(extracted)
    alert_ids = [a["id"] for a in alerts]
    assert "RF-03" in alert_ids


def test_rule_rf04_fever_with_neck_stiffness(rule_engine):
    """RF-04 must trigger when fever is accompanied by neck stiffness."""
    extracted = {
        "chief_complaint": {"value": "High fever", "status": "known", "evidence": "fever"},
        "associated_symptoms": {"value": ["Stiff neck", "neck pain"], "status": "known", "evidence": "stiff neck"}
    }
    alerts = rule_engine.evaluate(extracted)
    alert_ids = [a["id"] for a in alerts]
    assert "RF-04" in alert_ids


def test_rule_rf06_stroke_focal_deficit(rule_engine):
    """RF-06 must trigger on focal neurological deficit such as slurred speech."""
    extracted = {
        "chief_complaint": {"value": "Slurred speech and arm weakness", "status": "known", "evidence": "slurred speech"}
    }
    alerts = rule_engine.evaluate(extracted)
    alert_ids = [a["id"] for a in alerts]
    assert "RF-06" in alert_ids


def test_rule_rf08_prolonged_fever_over_7_days(rule_engine):
    """RF-08 must trigger when fever duration exceeds 7 days."""
    extracted = {
        "chief_complaint": {"value": "Fever", "status": "known", "evidence": "fever"},
        "duration": {"value": "10 days", "status": "known", "evidence": "10 days"}
    }
    alerts = rule_engine.evaluate(extracted)
    alert_ids = [a["id"] for a in alerts]
    assert "RF-08" in alert_ids


def test_rule_rf09_hemoptysis(rule_engine):
    """RF-09 must trigger when coughing blood is reported."""
    extracted = {
        "chief_complaint": {"value": "Coughing blood", "status": "known", "evidence": "coughing blood"}
    }
    alerts = rule_engine.evaluate(extracted)
    alert_ids = [a["id"] for a in alerts]
    assert "RF-09" in alert_ids


def test_emergency_112_detection():
    """Emergency keywords must immediately trigger 112 emergency response without LLM."""
    res_en = check_emergency("The patient is unconscious and not breathing")
    assert res_en is not None
    assert res_en["is_emergency"] is True
    assert "112" in res_en["alert_message"]

    res_ta = check_emergency("நோயாளி மயக்கம் அடைந்துவிட்டார்")
    assert res_ta is not None
    assert res_ta["is_emergency"] is True


def test_safety_filter_blocks_treatment_and_dosages():
    """Safety filter must redact drug dosages and prescription treatment advice."""
    unsafe_text = "Patient should take paracetamol 500mg twice daily and start amoxicillin."
    sanitized, violations = filter_text_safety(unsafe_text)
    assert len(violations) > 0
    assert "500mg" not in sanitized
    assert "REDACTED" in sanitized


def test_safety_filter_blocks_definitive_diagnoses():
    """Safety filter must redact definitive disease diagnoses."""
    unsafe_text = "Diagnosis: severe pneumonia with chronic obstructive pulmonary disease."
    sanitized, violations = filter_text_safety(unsafe_text)
    assert len(violations) > 0
    assert "pneumonia" not in sanitized.lower()
    assert "REDACTED" in sanitized


def test_tamil_acceptance_scenario(extractor):
    """Acceptance test: Tamil complaint produces Known/Unknown items and Needs Attention rule alert."""
    tamil_complaint = "எனக்கு 4 நாளா கடுமையான இருமலும் மூச்சுத்திணறலும் இருக்கு. ரொம்ப கஷ்டமா இருக்கு."
    req = ExtractRequest(
        session_id="test-tamil-session",
        conversation_history=[],
        latest_input=tamil_complaint,
        language="ta",
        skipped_fields=[]
    )
    res = extractor.extract(req)
    
    # 1. Chief complaint and duration must be KNOWN with Tamil evidence
    assert res.extracted_fields.chief_complaint.status == "known"
    assert res.extracted_fields.duration.status == "known"
    assert res.extracted_fields.duration.evidence is not None

    # 2. Key gaps like fever / onset / medications must be UNKNOWN
    assert res.extracted_fields.medications.status == "unknown"
    assert res.extracted_fields.onset.status == "unknown"

    # 3. Exactly one follow-up question for highest priority unknown in Tamil
    assert res.highest_priority_unknown is not None
    assert res.highest_priority_unknown.question != ""

    # 4. Deterministic Rule Engine triggers Needs Attention alert RF-02
    alert_ids = [item.id for item in res.needs_attention]
    assert "RF-02" in alert_ids
    rf02 = next(a for a in res.needs_attention if a.id == "RF-02")
    assert rf02.source == "DRAFT - requires clinician review"
