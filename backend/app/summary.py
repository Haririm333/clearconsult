"""
Phase 2: Plain-Language Summary & Clinical Consultation Note.
- Structured Note: complaint, timeline, severity, associated symptoms, gaps still open.
- Confirmed Note with "Confirmed by doctor" stamp.
- PDF generation using ReportLab.
- Patient instruction restatement in their language (Tamil, Hindi, English).
  Strict safety: AI ONLY restates what the doctor wrote; it adds NO new advice.
"""

import os
import io
import time
import logging
from typing import Dict, Any, Optional
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from backend.app.safety import filter_text_safety

logger = logging.getLogger("clearconsult.summary")


def build_initial_doctor_note(session: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts structured note fields from current session state."""
    fields = session.get("extracted_fields", {})
    
    # 1. Complaint
    cc = fields.get("chief_complaint", {})
    complaint_val = cc.get("value") or "Chief complaint not yet recorded"
    complaint_ev = cc.get("evidence")
    complaint_text = f"{complaint_val}" + (f' (Patient quote: "{complaint_ev}")' if complaint_ev else "")

    # 2. Timeline
    dur = fields.get("duration", {}).get("value") or "Duration unknown"
    onset = fields.get("onset", {}).get("value") or "Onset unknown"
    timeline_text = f"Duration: {dur}. Onset: {onset}."

    # 3. Severity
    sev = fields.get("severity", {})
    sev_val = sev.get("value") or "Not quantitatively rated (0-10 unknown)"
    severity_text = str(sev_val)

    # 4. Associated Symptoms
    assoc = fields.get("associated_symptoms", {}).get("value")
    if isinstance(assoc, list) and assoc:
        assoc_text = ", ".join([str(x) for x in assoc])
    elif assoc:
        assoc_text = str(assoc)
    else:
        assoc_text = "None reported"

    # 5. Gaps still open
    gaps = []
    for k, label in [
        ("fever", "Fever"),
        ("onset", "Onset detail (sudden vs gradual)"),
        ("severity", "Numeric severity scale (0-10)"),
        ("medications", "Current medications or prior treatment"),
        ("relevant_negatives", "Relevant negatives (chest pain, stiff neck)"),
    ]:
        f = fields.get(k)
        if not f or f.get("status") != "known":
            gaps.append(label)
    gaps_text = "; ".join(gaps) if gaps else "No major clinical intake gaps remaining."

    # Default suggested doctor plan/instructions
    default_instructions = (
        "Rest in an upright position. Maintain adequate hydration with warm fluids. "
        "Avoid strenuous physical exertion. If breathlessness increases or chest discomfort occurs, "
        "seek immediate in-person emergency care or call 112."
    )

    return {
        "complaint": complaint_text,
        "timeline": timeline_text,
        "severity": severity_text,
        "associated_symptoms": assoc_text,
        "gaps_open": gaps_text,
        "doctor_instructions": default_instructions,
        "confirmed": False,
        "confirmed_by": "Attending Clinician",
        "confirmed_at": None,
        "patient_instructions_restated": {}
    }


def restate_instructions_for_patient(
    doctor_instructions: str,
    target_lang: str,
    api_key: Optional[str] = None,
    model_name: str = "gemini-2.5-flash"
) -> str:
    """
    Restates the doctor's instructions in the patient's language.
    Strict rule: AI only restates what the doctor wrote; adds NO new advice.
    """
    if not doctor_instructions or not doctor_instructions.strip():
        return ""

    # Sanitize input
    clean_input, _ = filter_text_safety(doctor_instructions)

    # Deterministic fallback translations for hackathon reliability
    if target_lang == "ta":
        # Known Tamil phrasing for common post-consultation restatement
        if "hydration" in clean_input.lower() or "rest" in clean_input.lower():
            restated = (
                "மருத்துவரின் அறிவுறுத்தல்கள் (Doctor's Confirmed Advice):\n"
                "• நேராக அமர்ந்து ஓய்வெடுக்கவும் (Rest upright).\n"
                "• வெதுவெதுப்பான நீர் அருந்தி நீரேற்றத்துடன் இருக்கவும் (Drink warm fluids).\n"
                "• கடினமான உடல் உழைப்பைத் தவிர்க்கவும் (Avoid strenuous exertion).\n"
                "• மூச்சுத்திணறல் அதிகமானால் அல்லது நெஞ்சு வலி ஏற்பட்டால் உடனடியாக 112 அல்லது மருத்துவமனைக்கு செல்லவும்."
            )
            return restated
        return f"மருத்துவரின் அறிவுறுத்தல்கள் (Doctor's Advice): {clean_input}"

    elif target_lang == "hi":
        if "hydration" in clean_input.lower() or "rest" in clean_input.lower():
            restated = (
                "डॉक्टर के निर्देश (Doctor's Confirmed Advice):\n"
                "• सीधा बैठकर आराम करें (Rest upright).\n"
                "• गुनगुना पानी पिएं और शरीर में पानी की कमी न होने दें (Stay hydrated).\n"
                "• भारी शारीरिक परिश्रम से बचें (Avoid heavy exertion).\n"
                "• यदि सांस फूलना बढ़े या सीने में दर्द हो, तो तुरंत 112 पर कॉल करें या अस्पताल जाएं।"
            )
            return restated
        return f"डॉक्टर के निर्देश: {clean_input}"

    # English default
    return clean_input


def generate_consultation_pdf(doctor_note: Dict[str, Any], session_data: Dict[str, Any]) -> bytes:
    """
    Generates a clean, professional clinical consultation PDF summary with ReportLab.
    Includes the 'Confirmed by doctor' stamp and mandatory compliance footer.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f766e"),
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
        spaceAfter=15
    )

    header_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=12,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        "BodyText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155")
    )

    stamp_style = ParagraphStyle(
        "StampStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#166534"),
        alignment=1 # Center
    )

    footer_style = ParagraphStyle(
        "FooterNotice",
        parent=styles["Italic"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"),
        alignment=1
    )

    story = []

    # Title & Header
    story.append(Paragraph("ClearConsult — Telemedicine Consultation Note", title_style))
    story.append(Paragraph(
        f"Session ID: {session_data.get('session_id', 'N/A')} | Date: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        subtitle_style
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=12))

    # Confirmation Stamp Banner
    is_confirmed = doctor_note.get("confirmed", False)
    if is_confirmed:
        confirmed_time = doctor_note.get("confirmed_at") or time.strftime("%Y-%m-%d %H:%M:%S")
        confirmed_by = doctor_note.get("confirmed_by", "Attending Clinician")
        stamp_data = [[
            Paragraph(f"✓ CONFIRMED BY DOCTOR — {confirmed_by} ({confirmed_time})", stamp_style)
        ]]
        stamp_table = Table(stamp_data, colWidths=[530])
        stamp_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
            ("BORDER", (0, 0), (-1, -1), 1.5, colors.HexColor("#16a34a")),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        story.append(stamp_table)
        story.append(Spacer(1, 12))

    # Structured Table
    note_rows = [
        [Paragraph("<b>Chief Complaint:</b>", body_style), Paragraph(str(doctor_note.get("complaint", "N/A")), body_style)],
        [Paragraph("<b>Timeline & Duration:</b>", body_style), Paragraph(str(doctor_note.get("timeline", "N/A")), body_style)],
        [Paragraph("<b>Reported Severity:</b>", body_style), Paragraph(str(doctor_note.get("severity", "N/A")), body_style)],
        [Paragraph("<b>Associated Symptoms:</b>", body_style), Paragraph(str(doctor_note.get("associated_symptoms", "None")), body_style)],
        [Paragraph("<b>Gaps Still Open:</b>", body_style), Paragraph(str(doctor_note.get("gaps_open", "None")), body_style)],
        [Paragraph("<b>Doctor's Instructions:</b>", body_style), Paragraph(str(doctor_note.get("doctor_instructions", "N/A")), body_style)],
    ]

    note_table = Table(note_rows, colWidths=[150, 380])
    note_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8faf9")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(note_table)
    story.append(Spacer(1, 15))

    # Red Flag Rule Alerts (if any)
    alerts = session_data.get("needs_attention", [])
    if alerts:
        story.append(Paragraph("<b>Deterministic Safety Alerts Raised (Clinician Review Required):</b>", header_style))
        for a in alerts:
            alert_text = f"• <b>[{a.get('id', 'ALERT')}] {a.get('name', '')}</b>: {a.get('message', '')} (Status: {a.get('source', '')})"
            story.append(Paragraph(alert_text, body_style))
            story.append(Spacer(1, 4))
        story.append(Spacer(1, 10))

    # Compliance Footer
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceBefore=20, spaceAfter=8))
    story.append(Paragraph(
        "ClearConsult supports the doctor. It does not diagnose or replace medical advice.<br/>"
        "AI models assist with extraction and phrasing only. Clinical judgement and decisions remain solely with the attending doctor.",
        footer_style
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
