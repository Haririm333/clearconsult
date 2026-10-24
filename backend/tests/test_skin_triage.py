import pytest
from backend.app.skin_triage import evaluate_skin_urgency, analyze_skin_photo


def test_skin_urgency_routine():
    urgency = evaluate_skin_urgency(
        reported_duration="2 days",
        symptoms="mild itching on forearm",
        rapid_growth=False,
        systemic_signs=False
    )
    assert urgency == "routine"


def test_skin_urgency_see_doctor_soon():
    urgency = evaluate_skin_urgency(
        reported_duration="3 weeks",
        symptoms="bleeding ulcer non-healing",
        rapid_growth=False,
        systemic_signs=False
    )
    assert urgency == "see doctor soon"


def test_skin_urgency_seek_care_urgently():
    urgency = evaluate_skin_urgency(
        reported_duration="1 day",
        symptoms="spreading fast with fever and severe pain",
        rapid_growth=True,
        systemic_signs=True
    )
    assert urgency == "seek care urgently"


def test_analyze_skin_photo_non_diagnostic():
    fake_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb"
    res = analyze_skin_photo(
        image_bytes=fake_jpeg,
        reported_duration="3 days",
        body_location="Forearm",
        api_key=None
    )
    assert "visible_description" in res
    desc = res["visible_description"]
    assert "colour" in desc
    assert "size_estimate" in desc
    assert "shape" in desc
    assert "texture" in desc
    # Must NOT name diseases
    assert "melanoma" not in str(res).lower()
    assert "eczema" not in str(res).lower()
    assert "dermatitis" not in str(res).lower()
    assert "prescription" not in str(res).lower()
    assert res["urgency_flag"] in ("routine", "see doctor soon", "seek care urgently")
