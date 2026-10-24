import pytest
from backend.app.summary import (
    build_initial_doctor_note,
    restate_instructions_for_patient,
    generate_consultation_pdf
)


def test_build_initial_doctor_note():
    session = {
        "extracted_fields": {
            "chief_complaint": {"value": "Cough and breathlessness", "status": "known", "evidence": "coughing 4 days"},
            "duration": {"value": "4 days", "status": "known", "evidence": "4 days"},
            "onset": {"value": None, "status": "unknown"},
            "severity": {"value": "Severe", "status": "known", "evidence": "severe"},
            "associated_symptoms": {"value": ["Dyspnea"], "status": "known"},
            "medications": {"value": None, "status": "unknown"}
        }
    }
    note = build_initial_doctor_note(session)
    assert "Cough and breathlessness" in note["complaint"]
    assert "4 days" in note["timeline"]
    assert "Severe" in note["severity"]
    assert "Dyspnea" in note["associated_symptoms"]
    assert "Onset" in note["gaps_open"]
    assert note["confirmed"] is False


def test_restate_instructions_tamil():
    doc_text = "Rest in an upright position and drink warm fluids."
    restated = restate_instructions_for_patient(doc_text, target_lang="ta")
    assert "மருத்துவரின் அறிவுறுத்தல்கள்" in restated
    assert "ஓய்வெடுக்கவும்" in restated or "Rest" in restated


def test_restate_instructions_safety_no_new_advice():
    # If text has forbidden dosage or diagnosis injection, filter strips it
    unsafe_doc_text = "Take 500mg paracetamol and diagnose pneumonia"
    restated = restate_instructions_for_patient(unsafe_doc_text, target_lang="en")
    assert "500mg" not in restated
    assert "pneumonia" not in restated.lower()


def test_generate_consultation_pdf():
    note = {
        "complaint": "Severe breathlessness",
        "timeline": "4 days",
        "severity": "8/10",
        "associated_symptoms": "Cough",
        "gaps_open": "Fever not reported",
        "doctor_instructions": "Rest and monitor",
        "confirmed": True,
        "confirmed_by": "Dr. Test Clinician",
        "confirmed_at": "2026-10-24 13:00:00"
    }
    session = {
        "session_id": "test-pdf-session",
        "needs_attention": [{"id": "RF-02", "name": "Severe Breathlessness", "message": "Clinician review required", "source": "DRAFT"}]
    }
    pdf_bytes = generate_consultation_pdf(note, session)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF-")
