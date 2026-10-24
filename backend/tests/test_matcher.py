"""
Unit tests for ClearConsult Multi-Consultation Backend:
- Doctor presence registry & 15-second heartbeat timeout
- FIFO queue ordering and position reporting
- Matcher algorithm preventing double-assignment
- Doctor going offline mid-queue
- Manual patient acceptance from waiting list
- Clean session end & auto-dispatch of next patient
- Strict session isolation across concurrent consults
- WebRTC STUN/TURN configuration
- Demo multi-room seed state
"""

import time
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.queue_manager import doctor_registry, queue_manager
from backend.app.state import session_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    """Reset doctor registry and queue state before each test."""
    doctor_registry._doctors.clear()
    queue_manager._waiting_queue.clear()
    session_store._sessions.clear()
    yield


def test_doctor_registration_and_peer_id():
    """Requirement 1: /doctor requires name/id. PeerJS ID is doctor-<id>. Status available."""
    res = client.post("/doctors/register", json={
        "id": "aravind",
        "name": "Dr. Aravind Swaminathan",
        "specialty": "General Medicine"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "aravind"
    assert data["peer_id"] == "doctor-aravind"
    assert data["status"] == "available"

    # List doctors
    list_res = client.get("/doctors")
    assert list_res.status_code == 200
    docs = list_res.json()
    assert len(docs) == 1
    assert docs[0]["peer_id"] == "doctor-aravind"


def test_doctor_heartbeat_and_15s_timeout():
    """Requirement 1: Heartbeat keeps doctor alive. 15s missed heartbeat marks offline."""
    client.post("/doctors/register", json={
        "id": "priya",
        "name": "Dr. Priya Sharma"
    })

    # Send heartbeat
    hb_res = client.post("/doctors/priya/heartbeat")
    assert hb_res.status_code == 200
    assert hb_res.json()["status"] == "available"

    # Simulate 16 seconds elapsed without heartbeat
    doctor_registry._doctors["priya"]["last_heartbeat"] = time.time() - 16.0
    expired = doctor_registry.check_heartbeats()
    assert "priya" in expired
    assert doctor_registry.get_doctor("priya")["status"] == "offline"

    # Sending heartbeat restores doctor presence
    restore_res = client.post("/doctors/priya/heartbeat")
    assert restore_res.status_code == 200
    assert restore_res.json()["status"] == "available"


def test_matcher_no_double_assigning():
    """Requirement 2 & 3: Matcher never double-assigns a busy doctor."""
    # 1 doctor available
    client.post("/doctors/register", json={"id": "doc1", "name": "Dr. One"})

    # Patient 1 requests consultation -> should match immediately
    res1 = client.post("/consults", json={
        "session_id": "sess-pat-1",
        "patient_id": "p1",
        "patient_name": "Patient One"
    })
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["status"] == "matched"
    assert d1["assigned_doctor_id"] == "doc1"
    assert d1["assigned_doctor_peer_id"] == "doctor-doc1"
    assert d1["queue_position"] == 0

    # Doctor 1 is now BUSY
    doc_state = doctor_registry.get_doctor("doc1")
    assert doc_state["status"] == "busy"
    assert doc_state["current_session_id"] == "sess-pat-1"

    # Patient 2 requests consultation -> NO doctor available -> queued at position 1
    res2 = client.post("/consults", json={
        "session_id": "sess-pat-2",
        "patient_id": "p2",
        "patient_name": "Patient Two"
    })
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["status"] == "waiting"
    assert d2["assigned_doctor_id"] is None
    assert d2["queue_position"] == 1


def test_matcher_fifo_queue_order_and_auto_dispatch():
    """Requirement 2: FIFO order. Ending a call frees doctor and matches next queued patient."""
    client.post("/doctors/register", json={"id": "doc1", "name": "Dr. Dispatcher"})

    # Patient A matched immediately
    client.post("/consults", json={"session_id": "sess-a", "patient_name": "Alice"})

    # Patient B and Patient C queue up
    res_b = client.post("/consults", json={"session_id": "sess-b", "patient_name": "Bob"})
    res_c = client.post("/consults", json={"session_id": "sess-c", "patient_name": "Charlie"})

    assert res_b.json()["queue_position"] == 1
    assert res_c.json()["queue_position"] == 2

    # Check waiting list
    queue_res = client.get("/consults/queue")
    assert queue_res.status_code == 200
    waiting = queue_res.json()
    assert len(waiting) == 2
    assert waiting[0]["session_id"] == "sess-b"
    assert waiting[1]["session_id"] == "sess-c"

    # End Patient A's call -> Doctor 1 becomes available and auto-matches Patient B!
    end_res = client.post("/consults/sess-a/end", json={"reason": "completed"})
    assert end_res.status_code == 200
    assert end_res.json()["next_assigned_session"] == "sess-b"

    # Check Patient B status -> now matched with doc1
    status_b = client.get("/consults/sess-b/status").json()
    assert status_b["status"] == "matched"
    assert status_b["assigned_doctor_id"] == "doc1"

    # Patient C now moves to position 1
    status_c = client.get("/consults/sess-c/status").json()
    assert status_c["status"] == "waiting"
    assert status_c["queue_position"] == 1


def test_doctor_offline_mid_queue_not_assigned():
    """Requirement 1 & 2: If doctor goes offline, matcher does not assign them."""
    client.post("/doctors/register", json={"id": "doc-flaky", "name": "Dr. Flaky"})
    
    # Simulate missed heartbeat -> offline
    doctor_registry._doctors["doc-flaky"]["last_heartbeat"] = time.time() - 20.0
    doctor_registry.check_heartbeats()

    # Patient requests consult -> doctor is offline, patient must queue
    res = client.post("/consults", json={"session_id": "sess-offline-test", "patient_name": "Dave"})
    assert res.json()["status"] == "waiting"
    assert res.json()["queue_position"] == 1
    assert res.json()["assigned_doctor_id"] is None


def test_manual_doctor_acceptance_from_waiting_list():
    """Requirement 2: Doctor can manually accept a specific patient from the waiting panel."""
    client.post("/doctors/register", json={"id": "doc-hero", "name": "Dr. Hero"})
    # Doctor busy initially
    doctor_registry.set_status("doc-hero", "busy")

    # 3 patients in queue
    client.post("/consults", json={"session_id": "sess-1", "patient_name": "Patient 1"})
    client.post("/consults", json={"session_id": "sess-priority", "patient_name": "Priority Patient"})
    client.post("/consults", json={"session_id": "sess-3", "patient_name": "Patient 3"})

    # Doctor finishes prior task and accepts patient 2 directly
    doctor_registry.set_status("doc-hero", "available")
    doctor_registry._doctors["doc-hero"]["current_session_id"] = None

    accept_res = client.post("/consults/sess-priority/accept", json={"doctor_id": "doc-hero"})
    assert accept_res.status_code == 200
    data = accept_res.json()
    assert data["status"] == "matched"
    assert data["assigned_doctor_id"] == "doc-hero"

    # Priority patient removed from queue; sess-1 and sess-3 remain
    waiting_list = client.get("/consults/queue").json()
    waiting_sids = [p["session_id"] for p in waiting_list]
    assert "sess-priority" not in waiting_sids
    assert waiting_sids == ["sess-1", "sess-3"]


def test_session_isolation_across_multiple_concurrent_calls():
    """Requirement 4 (Critical): State is strictly isolated per sessionId."""
    # Create 3 completely different sessions
    s1 = "session-iso-tamil"
    s2 = "session-iso-hindi"
    s3 = "session-iso-english"

    # Patient 1: Tamil breathlessness
    client.post("/extract", json={
        "session_id": s1,
        "latest_input": "எனக்கு 4 நாளா கடுமையான இருமலும் மூச்சுத்திணறலும் இருக்கு.",
        "language": "ta"
    })

    # Patient 2: Hindi headache
    client.post("/extract", json={
        "session_id": s2,
        "latest_input": "मुझे आज सुबह से अचानक बहुत भयानक सिरदर्द है (9/10)।",
        "language": "hi"
    })

    # Patient 3: English routine
    client.post("/extract", json={
        "session_id": s3,
        "latest_input": "I have had a mild sore throat for 2 days.",
        "language": "en"
    })

    # Update doctor note for session 1 only
    client.post(f"/session/{s1}/doctor-note", json={
        "complaint": "Tamil severe breathlessness",
        "severity": "8/10",
        "doctor_instructions": "Take steam and rest"
    })

    # Confirm note for session 1 only
    client.post(f"/session/{s1}/doctor-note/confirm", json={
        "doctor_name": "Dr. Aravind"
    })

    # Verify Session 1
    sess1 = client.get(f"/session/{s1}").json()
    assert sess1["language"] == "ta"
    assert sess1["doctor_note"]["confirmed"] is True
    assert sess1["doctor_note"]["confirmed_by"] == "Dr. Aravind"
    assert any(item["id"] == "RF-02" for item in sess1["needs_attention"])

    # Verify Session 2 has NOT been affected by Session 1
    sess2 = client.get(f"/session/{s2}").json()
    assert sess2["language"] == "hi"
    assert sess2["doctor_note"]["confirmed"] is False
    assert any(item["id"] == "RF-03" for item in sess2["needs_attention"])
    assert not any(item["id"] == "RF-02" for item in sess2["needs_attention"])

    # Verify Session 3 has zero red flags and unconfirmed note
    sess3 = client.get(f"/session/{s3}").json()
    assert sess3["language"] == "en"
    assert sess3["doctor_note"]["confirmed"] is False
    assert len(sess3["needs_attention"]) == 0


def test_webrtc_config_endpoint(monkeypatch):
    """Requirement 5: TURN server configuration through env vars."""
    monkeypatch.setenv("TURN_URL", "turn:turn.myclinic.org:3478")
    monkeypatch.setenv("TURN_USER", "clinicuser")
    monkeypatch.setenv("TURN_PASS", "secretpass")
    monkeypatch.setenv("PEERJS_HOST", "peerjs.myclinic.org")
    monkeypatch.setenv("PEERJS_PORT", "9000")

    res = client.get("/config/webrtc")
    assert res.status_code == 200
    cfg = res.json()
    assert cfg["peerjs_host"] == "peerjs.myclinic.org"
    assert cfg["peerjs_port"] == 9000

    urls = [s["urls"] for s in cfg["ice_servers"]]
    assert "stun:stun.l.google.com:19302" in urls
    assert "turn:turn.myclinic.org:3478" in urls

    turn_server = next(s for s in cfg["ice_servers"] if s["urls"] == "turn:turn.myclinic.org:3478")
    assert turn_server["username"] == "clinicuser"
    assert turn_server["credential"] == "secretpass"


def test_demo_seed_multi_room():
    """Requirement 7: Seed button creates 3 fake doctors and 4 queued patients."""
    res = client.post("/demo/seed-multi-room")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "seeded"
    assert data["doctors_count"] == 3
    assert data["waiting_queue_count"] == 4

    # Verify doctors list
    doctors = client.get("/doctors").json()
    assert len(doctors) == 3
    doc_ids = {d["id"]: d["status"] for d in doctors}
    assert doc_ids["aravind"] == "available"
    assert doc_ids["priya"] == "busy"
    assert doc_ids["rajesh"] == "available"

    # Verify waiting queue has 4 patients with triage alerts
    queue = client.get("/consults/queue").json()
    assert len(queue) == 4
    # First patient has RF-02
    assert queue[0]["session_id"] == "queue-tamil-kavitha"
    assert any(a["id"] == "RF-02" for a in queue[0]["needs_attention"])
    # Second has RF-03
    assert queue[1]["session_id"] == "queue-hindi-amitabh"
    assert any(a["id"] == "RF-03" for a in queue[1]["needs_attention"])
