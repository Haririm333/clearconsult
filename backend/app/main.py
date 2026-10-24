"""
ClearConsult Backend Service (FastAPI)
- Missing Information Detector (Phase 1)
- Plain-language summary & Confirmed Doctor Note (Phase 2)
- PDF Export & Multilingual Patient Instruction Restatement
- Deterministic Red Flags Rule Engine
- Emergency 112 Safety Interceptor
- Diagnostic / Treatment Redaction Guardrails
- In-memory multi-tab session synchronization
"""

import os
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from fastapi import FastAPI, HTTPException, Body, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional

from backend.app.schemas import ExtractRequest, ExtractResponse
from backend.app.extractor import ClinicalExtractor
from backend.app.state import session_store
from backend.app.rule_engine import RuleEngine
from backend.app.summary import (
    build_initial_doctor_note,
    restate_instructions_for_patient,
    generate_consultation_pdf
)
from backend.app.skin_triage import analyze_skin_photo

app = FastAPI(
    title="ClearConsult Telemedicine API",
    description="Clinical uncertainty & missing information detector. Supports clinician triage without diagnosing.",
    version="1.0.0"
)

# Enable CORS for Vite frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def strip_api_prefix(request, call_next):
    """Normalize /api prefix for Vercel serverless and local dev compatibility."""
    path = request.scope.get("path", "")
    if path.startswith("/api/"):
        request.scope["path"] = path[4:]
    elif path == "/api":
        request.scope["path"] = "/"
    return await call_next(request)


extractor = ClinicalExtractor()
rule_engine = RuleEngine()


@app.get("/")
def root():
    return {
        "service": "ClearConsult API",
        "status": "operational",
        "mock_mode": extractor.use_mock,
        "gemini_model": extractor.model_name,
        "notice": "ClearConsult supports the doctor. It does not diagnose or replace medical advice."
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/rules")
def get_rules():
    """Returns the loaded deterministic red flag rules."""
    return rule_engine.rules


@app.get("/session/{session_id}")
def get_session(session_id: str):
    """Returns current state for /doctor and /patient synchronization."""
    return session_store.get_or_create(session_id)


@app.post("/session/{session_id}/reset")
def reset_session(session_id: str):
    """Resets session state to blank slate."""
    return session_store.reset_session(session_id)


@app.post("/extract", response_model=ExtractResponse)
def extract_missing_info(req: ExtractRequest):
    """
    POST /extract
    Analyzes patient statements, marks known vs unknown fields with verbatim evidence,
    selects ONE follow-up question for highest priority unknown,
    and runs deterministic rule engine for Needs Attention alerts.
    """
    session_store.add_message(req.session_id, "patient", req.latest_input)

    result = extractor.extract(req)

    session_store.update(req.session_id, {
        "language": result.language,
        "extracted_fields": result.extracted_fields.model_dump(),
        "highest_priority_unknown": result.highest_priority_unknown.model_dump() if result.highest_priority_unknown else None,
        "needs_attention": [item.model_dump() for item in result.needs_attention],
        "is_emergency": result.is_emergency,
        "emergency_alert": result.emergency_alert,
        "skipped_fields": req.skipped_fields
    })

    if result.highest_priority_unknown:
        session_store.add_message(req.session_id, "system", result.highest_priority_unknown.question)

    return result


@app.post("/session/{session_id}/skip")
def skip_field(session_id: str, payload: Dict[str, str] = Body(...)):
    """Skips the specified field and picks the next highest priority unknown."""
    field_to_skip = payload.get("field")
    if not field_to_skip:
        raise HTTPException(status_code=400, detail="Missing 'field' in request body")

    session = session_store.get_or_create(session_id)
    skipped = session.get("skipped_fields", [])
    if field_to_skip not in skipped:
        skipped.append(field_to_skip)
    session["skipped_fields"] = skipped

    extracted_fields = session.get("extracted_fields", {})
    lang = session.get("language", "en")
    next_q = extractor._determine_highest_priority_unknown(extracted_fields, lang, skipped)
    
    session["highest_priority_unknown"] = next_q.model_dump() if next_q else None
    if next_q:
        session_store.add_message(session_id, "system", next_q.question)
    
    return session


# =========================================================================
# PHASE 2: Plain-Language Summary & Doctor Note
# =========================================================================

@app.get("/session/{session_id}/doctor-note")
def get_doctor_note(session_id: str):
    """Gets or initializes the short structured note for the clinician."""
    session = session_store.get_or_create(session_id)
    existing_note = session.get("doctor_note", {})
    
    # If not populated or missing complaint, generate from current fields
    if not existing_note or not existing_note.get("complaint"):
        initial_note = build_initial_doctor_note(session)
        session["doctor_note"] = initial_note
        return initial_note
    return existing_note


@app.post("/session/{session_id}/doctor-note")
def update_doctor_note(session_id: str, note_data: Dict[str, Any] = Body(...)):
    """Doctor edits the structured note."""
    session = session_store.get_or_create(session_id)
    current_note = session.get("doctor_note", {})
    current_note.update(note_data)
    session["doctor_note"] = current_note
    return current_note


@app.post("/session/{session_id}/doctor-note/confirm")
def confirm_doctor_note(session_id: str, payload: Dict[str, Any] = Body(default={})):
    """
    Confirms note by doctor. Stamps with 'Confirmed by doctor' and timestamp.
    Restates doctor instructions into patient's language.
    Strictly forbids adding new advice.
    """
    session = session_store.get_or_create(session_id)
    note = session.get("doctor_note") or build_initial_doctor_note(session)
    
    # Apply confirmation stamp
    note["confirmed"] = True
    note["confirmed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    note["confirmed_by"] = payload.get("doctor_name", "Attending Clinician (Dr. Verified)")

    if "doctor_instructions" in payload:
        note["doctor_instructions"] = payload["doctor_instructions"]

    # Restate in patient's language
    patient_lang = session.get("language", "en")
    doctor_inst = note.get("doctor_instructions", "")
    restated = restate_instructions_for_patient(
        doctor_instructions=doctor_inst,
        target_lang=patient_lang,
        api_key=extractor.api_key,
        model_name=extractor.model_name
    )
    
    if "patient_instructions_restated" not in note or not isinstance(note["patient_instructions_restated"], dict):
        note["patient_instructions_restated"] = {}
    note["patient_instructions_restated"][patient_lang] = restated

    session["doctor_note"] = note
    return {
        "status": "confirmed",
        "doctor_note": note,
        "patient_instructions": restated
    }


@app.get("/session/{session_id}/patient-instructions")
def get_patient_instructions(session_id: str):
    """
    Patient instruction screen:
    Simple screen in patient's language after the call.
    AI ONLY restates what the doctor wrote; adds NO new advice.
    """
    session = session_store.get_or_create(session_id)
    note = session.get("doctor_note", {})
    patient_lang = session.get("language", "en")

    doctor_confirmed = note.get("confirmed", False)
    doctor_inst = note.get("doctor_instructions", "")

    restated = (note.get("patient_instructions_restated") or {}).get(patient_lang)
    if not restated and doctor_inst:
        restated = restate_instructions_for_patient(
            doctor_instructions=doctor_inst,
            target_lang=patient_lang,
            api_key=extractor.api_key,
            model_name=extractor.model_name
        )

    return {
        "session_id": session_id,
        "language": patient_lang,
        "doctor_confirmed": doctor_confirmed,
        "confirmed_at": note.get("confirmed_at"),
        "confirmed_by": note.get("confirmed_by"),
        "instructions": restated or (
            "மருத்துவரின் அறிவுறுத்தல்கள் இன்னும் உறுதிப்படுத்தப்படவில்லை." if patient_lang == "ta"
            else "डॉक्टर के निर्देश अभी तक अंतिम रूप से पुष्ट नहीं हुए हैं।" if patient_lang == "hi"
            else "Doctor's instructions pending confirmation."
        ),
        "doctor_raw_text": doctor_inst,
        "notice": "The AI only restates what the doctor wrote. It adds no new advice."
    }


@app.get("/session/{session_id}/export-pdf")
def export_pdf(session_id: str):
    """Generates downloadable PDF of the confirmed consultation note."""
    session = session_store.get_or_create(session_id)
    note = session.get("doctor_note") or build_initial_doctor_note(session)
    pdf_bytes = generate_consultation_pdf(note, session)

    filename = f"ClearConsult_Note_{session_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/demo/load-tamil")
def load_tamil_demo(session_id: str = "demo-tamil-session"):
    """
    One-click demo scenario:
    Patient complaining in Tamil of 4-day cough and breathlessness, with fever not mentioned.
    Returns Known, Unknown, and Needs Attention from rule engine, plus preps Phase 2 note.
    """
    demo_input = "எனக்கு 4 நாளா கடுமையான இருமலும் மூச்சுத்திணறலும் இருக்கு. ரொம்ப கஷ்டமா இருக்கு."
    req = ExtractRequest(
        session_id=session_id,
        conversation_history=[],
        latest_input=demo_input,
        language="ta",
        skipped_fields=[]
    )
    result = extractor.extract(req)
    
    session_data = {
        "language": "ta",
        "conversation_history": [
            {"role": "patient", "text": demo_input, "timestamp": 1.0},
            {"role": "system", "text": result.highest_priority_unknown.question if result.highest_priority_unknown else "", "timestamp": 2.0}
        ],
        "extracted_fields": result.extracted_fields.model_dump(),
        "highest_priority_unknown": result.highest_priority_unknown.model_dump() if result.highest_priority_unknown else None,
        "needs_attention": [item.model_dump() for item in result.needs_attention],
        "is_emergency": False,
        "emergency_alert": None,
        "skipped_fields": []
    }

    # Pre-build structured doctor note
    initial_note = build_initial_doctor_note(session_data)
    session_data["doctor_note"] = initial_note
    session_store.update(session_id, session_data)
    
    return {
        "status": "success",
        "session_id": session_id,
        "data": result,
        "doctor_note": initial_note
    }


# =========================================================================
# PHASE 5: Skin Photo Triage (Strictly Non-Diagnostic)
# =========================================================================

@app.post("/triage/skin-photo")
async def triage_skin_photo(
    file: UploadFile = File(...),
    duration: str = Form("3 days"),
    location: str = Form("Forearm")
):
    """
    Analyzes skin photo using objective visual feature extraction.
    Strictly forbids naming diseases or prescribing treatments.
    Returns: visible_description, patient_reported_duration, urgency_flag.
    """
    image_bytes = await file.read()
    result = analyze_skin_photo(
        image_bytes=image_bytes,
        reported_duration=duration,
        body_location=location,
        api_key=extractor.api_key,
        model_name=extractor.model_name
    )
    return result

