# ClearConsult

> Telemedicine Clinical Uncertainty & Missing Information Detector.  
> **Notice:** ClearConsult supports the doctor. It does not diagnose or replace medical advice.

---

## Overview

ClearConsult sits inside a video consultation. It **never diagnoses**. It parses patient statements and clinical observations into three distinct states for the attending clinician:
- **KNOWN**: Stated directly by the patient or measured, with verbatim quotes as evidence.
- **UNKNOWN**: Important clinical gaps not yet asked or answered, prioritized one question at a time.
- **NEEDS ATTENTION**: Predefined warning signs triggered strictly by a deterministic rule engine (`RF-01` to `RF-10`).

---

## Complete Feature Matrix (Phases 1–6)

1. **Phase 1: Missing Information Detector**:
   - Multilingual intake supporting **English**, **Tamil (`ta-IN`)**, and **Hindi (`hi-IN`)**.
   - Native Web Speech API voice input toggle.
   - Strict JSON extraction schema for chief complaint, onset, duration, severity (0-10), associated symptoms, relevant negatives, and medications with verbatim evidence.
   - Single follow-up question generation in patient language for highest-priority unknown with skip support.
   - Deterministic Rule Engine (`backend/rules/red_flags.json`) with 10 seeded clinical red flags (`RF-01` to `RF-10`).
   - Three-state triage panel on Doctor view.
   - Immediate 112 emergency bypass without model involvement.
   - Output redaction filter blocking diagnoses, disease names, and drug dosages.

2. **Phase 2: Plain-Language Summary**:
   - Short structured clinician note: complaint, timeline, severity, associated symptoms, gaps still open.
   - Clinician editing and single-click confirmation.
   - Green **"Confirmed by doctor"** stamp with clinician signature and timestamp.
   - Instant downloadable **PDF export** generated with ReportLab.
   - Simple post-consultation instruction screen for the patient in their language (Tamil, Hindi, English). Strict principle: The AI only restates what the doctor wrote; it adds no new advice.

3. **Phase 3: Video Consultation**:
   - Encrypted WebRTC video consultation powered by **PeerJS** between `/patient` and `/doctor`.
   - Picture-in-picture layout with local and remote video feeds.
   - Mic mute and camera toggle controls.
   - Pre-call consent screen ensuring zero video or audio is stored on any server.
   - Doctor dashboard displays live video on the left and the three-state triage panel on the right.

4. **Phase 4: Vitals Estimates (Always Labelled ESTIMATE)**:
   - Breathing rate tracking over a 30-second window with band-pass filter (0.15–0.55 Hz) and peak detection.
   - Signal confidence rating (`low`, `medium`, `high`) and *"Hold still for 30 seconds"* prompt.
   - Posture analysis: shoulder tilt and head-forward angle with simple clinical labels.
   - Every value explicitly marked: *"Estimate, not a clinical measurement"*.
   - **Mismatch rule (RF-10)**: If patient reports severe breathlessness and measured rate is normal or signal is poor, raises a *Needs Attention* item stating that video cannot confirm it. Never claims the patient is fine.

5. **Phase 5: Skin Photo Triage (No Diagnosis)**:
   - Patient skin photo upload with client-side quality checks (brightness, blur, resolution) prompting a retake if needed.
   - Gemini vision prompt strictly forbidding naming diseases or suggesting treatment.
   - Returns objective visual descriptors: colour, size estimate, shape, texture, and body location.
   - Deterministic urgency flag (`routine` / `see doctor soon` / `seek care urgently`) based only on rule engine criteria.

6. **Phase 6: Clinical How-To Guides**:
   - Static library of 4 medical devices: Digital Thermometer, BP Monitor, Inhaler, and Pulse Oximeter.
   - Step-by-step instructions with clean illustrations.
   - Fully translated in **English**, **Tamil (தமிழ்)**, and **Hindi (हिन्दी)**.

---

## What is Real vs Mocked

| Component / Feature | Implementation Status | Real vs Mocked Details |
| :--- | :--- | :--- |
| **Deterministic Rule Engine** | Real | Fully implemented in Python (`backend/app/rule_engine.py`). Evaluates rules `RF-01` to `RF-10` from `backend/rules/red_flags.json`. 100% deterministic; zero LLM hallucinations. |
| **Missing Information Extraction** | Real / Fallback | Uses `google-genai` when `GEMINI_API_KEY` is provided. If `USE_MOCK=true` or API is unavailable, automatically loads verified clinical fixtures (`backend/fixtures/`). |
| **Emergency 112 Interceptor** | Real | Pure regex and keyword matching in Python (`backend/app/safety.py`) and TypeScript. Bypasses the model entirely and surfaces immediate 112 guidance. |
| **Safety Redaction Filter** | Real | Scans all backend output for disease diagnosis names and drug dosages/prescriptions, redacting them and logging the block event. |
| **Multi-tab In-Memory State** | Real | FastAPI in-memory session store (`backend/app/state.py`). Real-time polling keeps `/patient` and `/doctor` tabs synchronized across browser windows. |
| **Doctor Note & PDF Export** | Real | Editable note in memory, green confirmation stamp with signature/timestamp, downloadable binary PDF generated via ReportLab. |
| **Patient Instruction Restatement**| Real | AI strictly restates what the doctor wrote in patient language (Tamil, Hindi, English). Forbids adding advice. |
| **WebRTC Video Call** | Real | PeerJS WebRTC peer-to-peer call between patient and doctor with mute and camera toggles. |
| **Vitals Estimation (Breathing & Posture)** | Real | Client-side 30-second window vertical motion tracking with band-pass filter and peak detection. Evaluates RF-10 mismatch rule. |
| **Skin Photo Quality Check & Triage** | Real | Client-side luminance and resolution validation. Backend visual feature extraction without disease naming. |
| **Device How-To Guides** | Real | 4 static device guides in English, Tamil, and Hindi. |

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Service (One Command)
```bash
python run_backend.py
```
*Runs on `http://127.0.0.1:8000`.*

### 2. Frontend Development Server (One Command)
```bash
cd frontend && npm run dev
```
*Runs on `http://localhost:5173`.*

---

## Automated Test Suite (25 Tests Passing)

Run the full pytest suite:
```bash
.\venv\Scripts\python.exe -m pytest backend/tests/ -v
```
All 25 tests pass covering:
- Rule engine alerts (`RF-01` to `RF-09`)
- Tamil severe breathlessness acceptance test (`RF-02`)
- Emergency 112 detection bypass
- Diagnosis and dosage safety filter redaction
- Structured doctor note generation and confirmation stamp
- Plain-language patient instruction restatement
- Binary PDF generation
- Breathing rate estimation, bandpass filtering, and peak detection
- Posture tilt estimation
- Discordant vitals mismatch rule (`RF-10`)
- Objective skin photo visual description and urgency flags

---

## 3-Minute Demo Script

| Time | Screen | Action | What to Demonstrate & Explain |
| :--- | :--- | :--- | :--- |
| **0:00 - 0:30** | `http://localhost:5173/` | Landing page | Explain core philosophy: ClearConsult sits inside a consultation and **never diagnoses**. Point out the compliance footer and the three states (Known, Unknown, Needs Attention). |
| **0:30 - 1:15** | `http://localhost:5173/patient` | Patient Intake Tab | 1. Select **Tamil (தமிழ்)**.<br>2. Click **[Tamil Acceptance]** test preset (*"எனக்கு 4 நாளா கடுமையான இருமலும் மூச்சுத்திணறலும் இருக்கு..."*).<br>3. Show the active single follow-up question in Tamil with the **Skip** button.<br>4. Test speech recognition mic toggle.<br>5. Open **Live Video Call** tab to show camera consent and WebRTC stream. |
| **1:15 - 2:00** | `http://localhost:5173/doctor` | Doctor View (separate tab) | 1. Observe real-time synchronization.<br>2. **KNOWN**: Shows Chief Complaint (*இருமல் மற்றும் மூச்சுத்திணறல்*) and Duration (*4 days*) with verbatim patient evidence.<br>3. **UNKNOWN**: Shows prioritized gaps (Fever, Onset, Numeric Severity, Medications).<br>4. **NEEDS ATTENTION**: Alert **`[RF-02]`** (*Severe or Progressive Breathlessness*) with source badge *"DRAFT - requires clinician review"*. Explain that only the deterministic rule engine can raise this.<br>5. **Vitals Estimates**: Show 30-second breathing rate estimate, confidence, posture labels, and Discordant Mismatch alert **`[RF-10]`**.<br>6. **WebRTC Video**: Live video feed on left and three-state panel on right. |
| **2:00 - 2:30** | `http://localhost:5173/doctor` | Consultation Note & PDF | 1. Scroll to **Structured Consultation Note**.<br>2. Click **Confirm & Sign Note**.<br>3. Observe the green **"Confirmed by doctor"** stamp with clinician signature and timestamp.<br>4. Click **Export PDF** to download the clean, official report. |
| **2:30 - 3:00** | `http://localhost:5173/patient` | Post-Call Instructions & Tools | 1. Show the banner: *"Doctor's Consultation Note Confirmed"*; switch to **Doctor's Instructions** tab.<br>2. Show doctor's instructions restated in Tamil. Highlight the guarantee: *"The AI only restates what the doctor wrote. It adds no new advice."*<br>3. Open **Guides** in navbar to show 4 device guides in Tamil/Hindi/English.<br>4. Open **Skin Photo** to demonstrate client-side blur/brightness quality checks and objective triage. |

---

## Compliance Notice
*ClearConsult supports the doctor. It does not diagnose or replace medical advice.*
