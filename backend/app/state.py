"""
In-memory session state manager for ClearConsult.
Shared across /patient and /doctor tabs with zero persistent DB footprint.
"""

import time
from typing import Dict, Any, Optional, List

class SessionStore:
    def __init__(self):
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def get_or_create(self, session_id: str) -> Dict[str, Any]:
        if session_id not in self._sessions:
            self._sessions[session_id] = {
                "session_id": session_id,
                "patient_id": None,
                "patient_name": "Anonymous Patient",
                "status": "intake",  # "intake" | "waiting" | "matched" | "in_call" | "ended"
                "assigned_doctor_id": None,
                "language": "en",
                "conversation_history": [],
                "extracted_fields": {
                    "chief_complaint": {"value": None, "status": "unknown", "evidence": None, "source": "inferred"},
                    "onset": {"value": None, "status": "unknown", "evidence": None, "source": "inferred"},
                    "duration": {"value": None, "status": "unknown", "evidence": None, "source": "inferred"},
                    "severity": {"value": None, "status": "unknown", "evidence": None, "source": "inferred"},
                    "associated_symptoms": {"value": [], "status": "unknown", "evidence": None, "source": "inferred"},
                    "relevant_negatives": {"value": [], "status": "unknown", "evidence": None, "source": "inferred"},
                    "medications": {"value": [], "status": "unknown", "evidence": None, "source": "inferred"},
                },
                "highest_priority_unknown": {
                    "field": "chief_complaint",
                    "question": "Could you please describe what primary symptom or discomfort brings you in today?",
                    "question_en": "Could you please describe what primary symptom or discomfort brings you in today?"
                },
                "needs_attention": [],
                "is_emergency": False,
                "emergency_alert": None,
                "skipped_fields": [],
                "vitals": {
                    "breathing_rate": None,
                    "confidence": "none",
                    "posture_shoulder_tilt": None,
                    "head_forward_angle": None,
                    "status_label": "Awaiting camera measurement"
                },
                "doctor_note": {
                    "complaint": "",
                    "timeline": "",
                    "severity": "",
                    "associated_symptoms": "",
                    "gaps_open": "",
                    "confirmed": False,
                    "confirmed_at": None
                },
                "peer_ids": {
                    "doctor": None,
                    "patient": None
                },
                "queued_at": None,
                "started_at": None,
                "ended_at": None,
                "created_at": time.time(),
                "updated_at": time.time()
            }
        return self._sessions[session_id]

    def update(self, session_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        session = self.get_or_create(session_id)
        session.update(data)
        session["updated_at"] = time.time()
        return session

    def add_message(self, session_id: str, role: str, text: str) -> Dict[str, Any]:
        session = self.get_or_create(session_id)
        session["conversation_history"].append({
            "role": role,
            "text": text,
            "timestamp": time.time()
        })
        session["updated_at"] = time.time()
        return session

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self._sessions.get(session_id)

    def list_sessions(self) -> List[Dict[str, Any]]:
        return list(self._sessions.values())

    def reset_session(self, session_id: str):
        if session_id in self._sessions:
            del self._sessions[session_id]
        return self.get_or_create(session_id)


# Global singleton instance
session_store = SessionStore()
