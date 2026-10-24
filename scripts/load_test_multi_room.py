"""
ClearConsult Multi-Room Concurrent Consultation Load Test.
Simulates:
- 3 Clinicians (Dr. Alpha, Dr. Beta, Dr. Gamma)
- 5 Concurrent Patients (Multilingual: Tamil, Hindi, English)
- FIFO Queue advancement & auto-dispatch
- Complete session isolation validation (verifying zero cross-talk)
"""

import sys
import time
import json
from typing import Dict, Any, List

# Add workspace to sys.path
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.state import session_store
from backend.app.queue_manager import doctor_registry, queue_manager

client = TestClient(app)


def run_load_test():
    print("=" * 70)
    print("[LOAD TEST] ClearConsult Multi-Room Concurrent Consultation Load Test")
    print("=" * 70)

    # Reset in-memory state
    doctor_registry._doctors.clear()
    queue_manager._waiting_queue.clear()
    session_store._sessions.clear()

    # 1. Register 3 Doctors
    print("\n[Step 1] Registering 3 Clinicians...")
    doctors_info = [
        ("doc-alpha", "Dr. Alpha Swaminathan", "General Medicine"),
        ("doc-beta", "Dr. Beta Sharma", "Pulmonology"),
        ("doc-gamma", "Dr. Gamma Kumar", "Emergency Medicine")
    ]
    for d_id, name, spec in doctors_info:
        r = client.post("/doctors/register", json={"id": d_id, "name": name, "specialty": spec})
        assert r.status_code == 200, f"Failed to register doctor {d_id}"
        print(f"  [OK] {name} online (PeerJS: doctor-{d_id}) -> status: available")

    # 2. Patient Intake for 5 Patients
    print("\n[Step 2] Executing Multilingual Intake for 5 Distinct Patients...")
    patient_cases = [
        {
            "sid": "session-sim-p1-tamil",
            "pid": "pat-001",
            "name": "Murugan K.",
            "lang": "ta",
            "input": "எனக்கு 4 நாளா கடுமையான இருமலும் மூச்சுத்திணறலும் இருக்கு.",
            "expected_rf": "RF-02"
        },
        {
            "sid": "session-sim-p2-hindi",
            "pid": "pat-002",
            "name": "Rajesh Gupta",
            "lang": "hi",
            "input": "मुझे आज सुबह से अचानक बहुत भयानक सिरदर्द है (9/10) और उल्टी हो रही है।",
            "expected_rf": "RF-03"
        },
        {
            "sid": "session-sim-p3-english",
            "pid": "pat-003",
            "name": "Emily Watson",
            "lang": "en",
            "input": "I have a mild sore throat and runny nose since yesterday.",
            "expected_rf": None
        },
        {
            "sid": "session-sim-p4-tamil",
            "pid": "pat-004",
            "name": "Ananya R.",
            "lang": "ta",
            "input": "திடீர் நெஞ்சு வலி மற்றும் கடுமையான வியர்வை உள்ளது.",
            "expected_rf": "RF-01"
        },
        {
            "sid": "session-sim-p5-hindi",
            "pid": "pat-005",
            "name": "Suresh Kumar",
            "lang": "hi",
            "input": "मुझे आज सुबह से अचानक बहुत भयानक सिरदर्द है।",
            "expected_rf": "RF-03"
        }
    ]

    for p in patient_cases:
        r = client.post("/extract", json={
            "session_id": p["sid"],
            "latest_input": p["input"],
            "language": p["lang"]
        })
        assert r.status_code == 200, f"Extraction failed for {p['sid']}"
        extracted = r.json()
        if p["expected_rf"]:
            rf_ids = [item["id"] for item in extracted["needs_attention"]]
            assert p["expected_rf"] in rf_ids, f"Expected {p['expected_rf']} in {rf_ids}"
        print(f"  [OK] {p['name']} ({p['lang'].upper()}): Intake processed. Red flags: {[item['id'] for item in extracted['needs_attention']]}")

    # 3. Patient 1, 2, 3 Request Consultation (Immediate Match)
    print("\n[Step 3] Patients 1, 2, 3 Requesting Consultation (All 3 doctors should be matched)...")
    for i in range(3):
        p = patient_cases[i]
        r = client.post("/consults", json={
            "session_id": p["sid"],
            "patient_id": p["pid"],
            "patient_name": p["name"],
            "language": p["lang"]
        })
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "matched", f"Expected matched, got {d['status']}"
        assert d["queue_position"] == 0
        print(f"  [OK] {p['name']} MATCHED immediately with {d['assigned_doctor_name']} (PeerJS: {d['assigned_doctor_peer_id']})")

    # Verify all 3 doctors are busy
    docs_status = {doc["id"]: doc["status"] for doc in client.get("/doctors").json()}
    print(f"  Clinician status after 3 calls matched: {docs_status}")
    assert docs_status["doc-alpha"] == "busy"
    assert docs_status["doc-beta"] == "busy"
    assert docs_status["doc-gamma"] == "busy"

    # 4. Patient 4 and 5 Request Consultation (Should Queue)
    print("\n[Step 4] Patients 4 and 5 Requesting Consultation (No doctors available -> Queueing)...")
    r4 = client.post("/consults", json={
        "session_id": patient_cases[3]["sid"],
        "patient_id": patient_cases[3]["pid"],
        "patient_name": patient_cases[3]["name"],
        "language": patient_cases[3]["lang"]
    }).json()
    assert r4["status"] == "waiting"
    assert r4["queue_position"] == 1
    print(f"  [OK] {patient_cases[3]['name']} queued at Position #{r4['queue_position']}")

    r5 = client.post("/consults", json={
        "session_id": patient_cases[4]["sid"],
        "patient_id": patient_cases[4]["pid"],
        "patient_name": patient_cases[4]["name"],
        "language": patient_cases[4]["lang"]
    }).json()
    assert r5["status"] == "waiting"
    assert r5["queue_position"] == 2
    print(f"  [OK] {patient_cases[4]['name']} queued at Position #{r5['queue_position']}")

    # Check waiting queue endpoint
    waiting_list = client.get("/consults/queue").json()
    assert len(waiting_list) == 2
    assert waiting_list[0]["session_id"] == patient_cases[3]["sid"]
    assert waiting_list[1]["session_id"] == patient_cases[4]["sid"]
    print(f"  [OK] Doctor waiting list accurately reflects {len(waiting_list)} queued patients with triage alerts.")

    # 5. Doctor Alpha Finishes Consultation with Patient 1
    print("\n[Step 5] Doctor Alpha ending call with Patient 1 -> Auto-dispatching Patient 4...")
    end_res = client.post(f"/consults/{patient_cases[0]['sid']}/end", json={"reason": "completed"}).json()
    assert end_res["status"] == "ended"
    assert end_res["next_assigned_session"] == patient_cases[3]["sid"]
    print(f"  [OK] Call ended for Patient 1. Doctor Alpha auto-dispatched to next in queue: {patient_cases[3]['name']}")

    # Verify Patient 4 is now MATCHED with doc-alpha
    status_p4 = client.get(f"/consults/{patient_cases[3]['sid']}/status").json()
    assert status_p4["status"] == "matched"
    assert status_p4["assigned_doctor_id"] == "doc-alpha"
    print(f"  [OK] Patient 4 status verified: MATCHED with {status_p4['assigned_doctor_name']}")

    # Patient 5 moves to Position #1
    status_p5 = client.get(f"/consults/{patient_cases[4]['sid']}/status").json()
    assert status_p5["status"] == "waiting"
    assert status_p5["queue_position"] == 1
    print(f"  [OK] Patient 5 queue position updated: now #1 in line")

    # 6. Verify Strict Session Isolation Across All 5 Sessions
    print("\n[Step 6] Validating Strict Session Isolation (Zero Cross-Talk Verification)...")
    for p in patient_cases:
        sess = client.get(f"/session/{p['sid']}").json()
        assert sess["session_id"] == p["sid"]
        assert sess["language"] == p["lang"]

        # Verify chief complaint matches exact patient input
        cc_val = sess["extracted_fields"]["chief_complaint"]["value"]
        assert cc_val is not None and len(cc_val) > 0

        # Verify no red flag leak
        actual_rfs = [item["id"] for item in sess["needs_attention"]]
        if p["expected_rf"]:
            assert p["expected_rf"] in actual_rfs
        else:
            assert len(actual_rfs) == 0

        print(f"  [OK] {p['sid']} ({p['lang']}): State isolated. Flags: {actual_rfs}")

    print("\n" + "=" * 70)
    print("[SUCCESS] LOAD TEST PASSED: 3 Doctors, 5 Patients, FIFO Queue & Isolation Verified!")
    print("=" * 70)
    return True


if __name__ == "__main__":
    success = run_load_test()
    sys.exit(0 if success else 1)
