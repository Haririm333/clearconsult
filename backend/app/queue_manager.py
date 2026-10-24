"""
ClearConsult In-Memory Multi-Consultation Registry, Queue & Matcher.
Manages:
- Doctor presence with 15-second heartbeat expiry.
- FIFO patient waiting queue with queue position calculation.
- Automatic matching of available doctors to waiting patients.
- Manual doctor acceptance from the waiting panel.
- Reconnection window (60s) and clean session teardown.
- Demo multi-room seeding (3 doctors, 4 queued patients).
"""

import time
import threading
from typing import Dict, Any, List, Optional
from backend.app.state import session_store
from backend.app.schemas import (
    DoctorRecord,
    DoctorStatus,
    ConsultResponse,
    WaitingPatientItem,
    NeedsAttentionItem,
    ConsultStatus,
)


class DoctorRegistry:
    def __init__(self, heartbeat_timeout: float = 15.0):
        self._lock = threading.Lock()
        self._doctors: Dict[str, Dict[str, Any]] = {}
        self.heartbeat_timeout = heartbeat_timeout

    def register(self, doctor_id: str, name: str, specialty: Optional[str] = "General Medicine") -> Dict[str, Any]:
        """Registers a doctor or updates existing doctor profile."""
        with self._lock:
            clean_id = doctor_id.strip()
            peer_id = f"doctor-{clean_id}"
            now = time.time()

            existing = self._doctors.get(clean_id)
            if existing:
                existing["name"] = name
                existing["specialty"] = specialty or existing.get("specialty", "General Medicine")
                existing["last_heartbeat"] = now
                # If was offline and not busy with a current session, restore to available
                if existing["status"] == "offline":
                    existing["status"] = "busy" if existing.get("current_session_id") else "available"
                return dict(existing)

            record = {
                "id": clean_id,
                "name": name,
                "status": "available",
                "peer_id": peer_id,
                "current_session_id": None,
                "last_heartbeat": now,
                "recent_sessions": [],
                "specialty": specialty or "General Medicine",
            }
            self._doctors[clean_id] = record
            return dict(record)

    def heartbeat(self, doctor_id: str) -> Optional[Dict[str, Any]]:
        """Updates doctor heartbeat timestamp."""
        with self._lock:
            doc = self._doctors.get(doctor_id)
            if not doc:
                return None
            doc["last_heartbeat"] = time.time()
            if doc["status"] == "offline":
                doc["status"] = "busy" if doc.get("current_session_id") else "available"
            return dict(doc)

    def set_status(self, doctor_id: str, status: DoctorStatus) -> Optional[Dict[str, Any]]:
        with self._lock:
            doc = self._doctors.get(doctor_id)
            if not doc:
                return None
            doc["status"] = status
            doc["last_heartbeat"] = time.time()
            return dict(doc)

    def check_heartbeats(self) -> List[str]:
        """Marks doctors offline if heartbeat was missed > timeout. Returns list of expired doctor IDs."""
        with self._lock:
            now = time.time()
            expired = []
            for doc_id, doc in self._doctors.items():
                if doc["status"] != "offline" and (now - doc["last_heartbeat"]) > self.heartbeat_timeout:
                    doc["status"] = "offline"
                    expired.append(doc_id)
            return expired

    def get_doctor(self, doctor_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            doc = self._doctors.get(doctor_id)
            return dict(doc) if doc else None

    def list_doctors(self) -> List[Dict[str, Any]]:
        self.check_heartbeats()
        with self._lock:
            return [dict(d) for d in self._doctors.values()]

    def get_available_doctor(self) -> Optional[Dict[str, Any]]:
        self.check_heartbeats()
        with self._lock:
            for doc in self._doctors.values():
                if doc["status"] == "available":
                    return doc
            return None


class ConsultationQueueManager:
    def __init__(self, doctor_registry: DoctorRegistry):
        self._lock = threading.Lock()
        self.doctor_registry = doctor_registry
        self._waiting_queue: List[str] = []  # Ordered list of session_ids (FIFO)

    def request_consultation(
        self,
        session_id: str,
        patient_id: Optional[str] = None,
        patient_name: Optional[str] = None,
        language: str = "en"
    ) -> ConsultResponse:
        """
        Patient finishes intake and requests a consultation.
        Assigns the first available doctor, or enqueues in waiting list.
        """
        with self._lock:
            session = session_store.get_or_create(session_id)
            p_id = patient_id or session.get("patient_id") or f"patient-{session_id}"
            p_name = patient_name or session.get("patient_name") or "Anonymous Patient"

            session["patient_id"] = p_id
            session["patient_name"] = p_name
            session["language"] = language
            session["queued_at"] = session.get("queued_at") or time.time()

            # If already matched or in call, return current status
            if session.get("status") in ["matched", "in_call"] and session.get("assigned_doctor_id"):
                doc = self.doctor_registry.get_doctor(session["assigned_doctor_id"])
                return ConsultResponse(
                    session_id=session_id,
                    patient_id=p_id,
                    status=session["status"],
                    assigned_doctor_id=session["assigned_doctor_id"],
                    assigned_doctor_name=doc["name"] if doc else None,
                    assigned_doctor_peer_id=doc["peer_id"] if doc else None,
                    queue_position=0,
                )

            # Check if any doctor is available
            avail_doc = self.doctor_registry.get_available_doctor()
            if avail_doc:
                # Match immediately
                self._assign_doctor_locked(session_id, avail_doc)
                if session_id in self._waiting_queue:
                    self._waiting_queue.remove(session_id)

                return ConsultResponse(
                    session_id=session_id,
                    patient_id=p_id,
                    status="matched",
                    assigned_doctor_id=avail_doc["id"],
                    assigned_doctor_name=avail_doc["name"],
                    assigned_doctor_peer_id=avail_doc["peer_id"],
                    queue_position=0,
                )

            # No available doctor -> enqueue
            session["status"] = "waiting"
            if session_id not in self._waiting_queue:
                self._waiting_queue.append(session_id)

            pos = self._waiting_queue.index(session_id) + 1
            return ConsultResponse(
                session_id=session_id,
                patient_id=p_id,
                status="waiting",
                assigned_doctor_id=None,
                assigned_doctor_name=None,
                assigned_doctor_peer_id=None,
                queue_position=pos,
            )

    def _assign_doctor_locked(self, session_id: str, doctor: Dict[str, Any]):
        """Internal helper to bind doctor and session (assumes self._lock is acquired)."""
        session = session_store.get_or_create(session_id)
        session["status"] = "matched"
        session["assigned_doctor_id"] = doctor["id"]

        doctor["status"] = "busy"
        doctor["current_session_id"] = session_id
        if session_id not in doctor["recent_sessions"]:
            doctor["recent_sessions"].insert(0, session_id)
            doctor["recent_sessions"] = doctor["recent_sessions"][:15]

    def get_status(self, session_id: str) -> ConsultResponse:
        """Returns live queue status or assigned doctor for a session."""
        with self._lock:
            session = session_store.get_or_create(session_id)
            status: ConsultStatus = session.get("status", "intake")
            assigned_id = session.get("assigned_doctor_id")

            doc_name = None
            doc_peer = None
            if assigned_id:
                doc = self.doctor_registry.get_doctor(assigned_id)
                if doc:
                    doc_name = doc["name"]
                    doc_peer = doc["peer_id"]

            pos = 0
            if session_id in self._waiting_queue:
                pos = self._waiting_queue.index(session_id) + 1

            return ConsultResponse(
                session_id=session_id,
                patient_id=session.get("patient_id", f"patient-{session_id}"),
                status=status,
                assigned_doctor_id=assigned_id,
                assigned_doctor_name=doc_name,
                assigned_doctor_peer_id=doc_peer,
                queue_position=pos,
            )

    def get_waiting_list(self) -> List[WaitingPatientItem]:
        """Returns patient details for all sessions currently waiting in the queue."""
        self.doctor_registry.check_heartbeats()
        with self._lock:
            now = time.time()
            results = []
            valid_queue = []

            for sid in self._waiting_queue:
                s = session_store.get_session(sid)
                if not s or s.get("status") != "waiting":
                    continue
                valid_queue.append(sid)

                # Extract chief complaint
                cc = (s.get("extracted_fields") or {}).get("chief_complaint", {})
                complaint_val = cc.get("value")
                if not complaint_val and s.get("conversation_history"):
                    first_p_msg = next((m["text"] for m in s["conversation_history"] if m.get("role") == "patient"), None)
                    complaint_val = first_p_msg

                queued_at = s.get("queued_at") or now
                wait_secs = max(0, int(now - queued_at))

                needs_att = []
                for item in s.get("needs_attention", []):
                    if isinstance(item, dict):
                        needs_att.append(NeedsAttentionItem(**item))
                    elif isinstance(item, NeedsAttentionItem):
                        needs_att.append(item)

                results.append(
                    WaitingPatientItem(
                        session_id=sid,
                        patient_id=s.get("patient_id", f"patient-{sid}"),
                        patient_name=s.get("patient_name", "Anonymous Patient"),
                        wait_seconds=wait_secs,
                        chief_complaint=complaint_val or "Awaiting initial intake description",
                        needs_attention=needs_att,
                        language=s.get("language", "en"),
                        queued_at=queued_at,
                    )
                )

            self._waiting_queue = valid_queue
            return results

    def accept_patient(self, doctor_id: str, session_id: str) -> ConsultResponse:
        """Doctor manually accepts a specific patient from the waiting list."""
        with self._lock:
            doc = self.doctor_registry.get_doctor(doctor_id)
            if not doc:
                raise ValueError(f"Doctor '{doctor_id}' is not registered.")

            if doc["status"] == "busy" and doc.get("current_session_id") != session_id:
                raise ValueError(f"Doctor '{doctor_id}' is already busy with another session.")

            session = session_store.get_or_create(session_id)
            if session_id in self._waiting_queue:
                self._waiting_queue.remove(session_id)

            self._assign_doctor_locked(session_id, doc)

            return ConsultResponse(
                session_id=session_id,
                patient_id=session.get("patient_id", f"patient-{session_id}"),
                status="matched",
                assigned_doctor_id=doc["id"],
                assigned_doctor_name=doc["name"],
                assigned_doctor_peer_id=doc["peer_id"],
                queue_position=0,
            )

    def start_call(self, session_id: str):
        """Called when WebRTC peer connection successfully establishes."""
        with self._lock:
            session = session_store.get_or_create(session_id)
            session["status"] = "in_call"
            session["started_at"] = session.get("started_at") or time.time()

    def end_consultation(self, session_id: str, reason: str = "completed") -> Dict[str, Any]:
        """
        Ends the consultation session.
        Frees up the doctor to available, and automatically dispatches the next queued patient!
        """
        with self._lock:
            session = session_store.get_or_create(session_id)
            session["status"] = "ended"
            session["ended_at"] = time.time()

            if session_id in self._waiting_queue:
                self._waiting_queue.remove(session_id)

            doc_id = session.get("assigned_doctor_id")
            next_assigned_session = None

            if doc_id:
                doc = self.doctor_registry.get_doctor(doc_id)
                if doc and doc.get("current_session_id") == session_id:
                    doc["current_session_id"] = None

                    # If doctor is still online, restore to available and auto-match next patient
                    if doc["status"] != "offline":
                        doc["status"] = "available"
                        if self._waiting_queue:
                            next_sid = self._waiting_queue.pop(0)
                            self._assign_doctor_locked(next_sid, doc)
                            next_assigned_session = next_sid

            return {
                "status": "ended",
                "session_id": session_id,
                "doctor_id": doc_id,
                "next_assigned_session": next_assigned_session,
                "reason": reason,
            }

    def seed_multi_room(self) -> Dict[str, Any]:
        """
        Demo mode seed:
        Creates 3 doctors (Dr. Aravind, Dr. Priya, Dr. Rajesh) and 4 queued patients with realistic triage data.
        """
        with self._lock:
            now = time.time()
            # 1. Register 3 Doctors
            d1 = self.doctor_registry.register("aravind", "Dr. Aravind Swaminathan, MD", "General Medicine")
            d2 = self.doctor_registry.register("priya", "Dr. Priya Sharma, MD", "Pulmonology")
            d3 = self.doctor_registry.register("rajesh", "Dr. Rajesh Kumar, MS", "Emergency Medicine")

            # 2. Setup 1 Active Call for Dr. Priya
            active_sid = "demo-active-priya"
            active_sess = session_store.get_or_create(active_sid)
            active_sess.update({
                "patient_id": "pat-rohan-01",
                "patient_name": "Rohan Patel (Age 42)",
                "status": "in_call",
                "assigned_doctor_id": "priya",
                "language": "en",
                "created_at": now - 600,
                "queued_at": now - 580,
                "started_at": now - 500,
            })
            self.doctor_registry._doctors["priya"]["status"] = "busy"
            self.doctor_registry._doctors["priya"]["current_session_id"] = active_sid
            if active_sid not in self.doctor_registry._doctors["priya"]["recent_sessions"]:
                self.doctor_registry._doctors["priya"]["recent_sessions"].insert(0, active_sid)

            # Set d1 and d3 as available
            self.doctor_registry._doctors["aravind"]["status"] = "available"
            self.doctor_registry._doctors["rajesh"]["status"] = "available"

            # 3. Seed 4 Queued Patients
            patients_seed = [
                {
                    "sid": "queue-tamil-kavitha",
                    "p_id": "pat-ta-01",
                    "name": "Kavitha M. (Age 38)",
                    "lang": "ta",
                    "wait": 240,
                    "complaint": "4 நாட்களாக இருமல் மற்றும் கடுமையான மூச்சுத்திணறல் (காய்ச்சல் இல்லை)",
                    "needs_attention": [
                        {
                            "id": "RF-02",
                            "name": "Severe Breathlessness",
                            "message": "Patient reported severe breathlessness. Check respiratory effort and vital signs immediately.",
                            "severity_level": "critical",
                            "source": "Deterministic Rule Engine (RF-02)"
                        }
                    ]
                },
                {
                    "sid": "queue-hindi-amitabh",
                    "p_id": "pat-hi-02",
                    "name": "Amitabh Verma (Age 55)",
                    "lang": "hi",
                    "wait": 170,
                    "complaint": "आज सुबह अचानक बहुत भयानक सिरदर्द (9/10) और उल्टी",
                    "needs_attention": [
                        {
                            "id": "RF-03",
                            "name": "Thunderclap Headache",
                            "message": "Sudden onset severe headache peak within minutes. Red flag for subarachnoid hemorrhage.",
                            "severity_level": "critical",
                            "source": "Deterministic Rule Engine (RF-03)"
                        }
                    ]
                },
                {
                    "sid": "queue-en-sarah",
                    "p_id": "pat-en-03",
                    "name": "Sarah Jenkins (Age 29)",
                    "lang": "en",
                    "wait": 95,
                    "complaint": "Persistent sore throat, mild dry cough, and fatigue for 3 days",
                    "needs_attention": []
                },
                {
                    "sid": "queue-tamil-venkatesh",
                    "p_id": "pat-ta-04",
                    "name": "Venkatesh S. (Age 61)",
                    "lang": "ta",
                    "wait": 40,
                    "complaint": "திடீர் நெஞ்சு அழுத்தம் மற்றும் கடுமையான வியர்வை",
                    "needs_attention": [
                        {
                            "id": "RF-01",
                            "name": "Chest Pain with Breathlessness",
                            "message": "Acute central chest pain reported. Red flag for acute coronary syndrome.",
                            "severity_level": "critical",
                            "source": "Deterministic Rule Engine (RF-01)"
                        }
                    ]
                }
            ]

            self._waiting_queue.clear()
            for p in patients_seed:
                sid = p["sid"]
                sess = session_store.get_or_create(sid)
                sess.update({
                    "patient_id": p["p_id"],
                    "patient_name": p["name"],
                    "language": p["lang"],
                    "status": "waiting",
                    "assigned_doctor_id": None,
                    "queued_at": now - p["wait"],
                    "needs_attention": p["needs_attention"],
                    "conversation_history": [
                        {"role": "patient", "text": p["complaint"], "timestamp": now - p["wait"]}
                    ],
                    "extracted_fields": {
                        "chief_complaint": {"value": p["complaint"], "status": "known", "evidence": p["complaint"], "source": "patient said"},
                        "onset": {"value": None, "status": "unknown", "evidence": None, "source": "inferred"},
                        "duration": {"value": None, "status": "unknown", "evidence": None, "source": "inferred"},
                        "severity": {"value": None, "status": "unknown", "evidence": None, "source": "inferred"},
                        "associated_symptoms": {"value": [], "status": "unknown", "evidence": None, "source": "inferred"},
                        "relevant_negatives": {"value": [], "status": "unknown", "evidence": None, "source": "inferred"},
                        "medications": {"value": [], "status": "unknown", "evidence": None, "source": "inferred"},
                    }
                })
                self._waiting_queue.append(sid)

            return {
                "status": "seeded",
                "doctors_count": len(self.doctor_registry.list_doctors()),
                "waiting_queue_count": len(self._waiting_queue),
                "active_call": active_sid,
            }


# Global singleton instances
doctor_registry = DoctorRegistry(heartbeat_timeout=15.0)
queue_manager = ConsultationQueueManager(doctor_registry=doctor_registry)
