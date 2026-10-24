import math
import pytest
from backend.app.vitals_estimator import (
    bandpass_filter_1d,
    detect_peaks,
    estimate_breathing_rate,
    estimate_posture,
    evaluate_vitals_mismatch
)


def generate_synthetic_respiration(
    rate_bpm: float = 16.0,
    duration_sec: float = 30.0,
    sampling_hz: float = 10.0,
    noise_amplitude: float = 0.002
):
    """Generates synthetic vertical landmark motion simulating chest expansion."""
    freq_hz = rate_bpm / 60.0 # e.g. 16/60 = 0.267 Hz
    total_samples = int(duration_sec * sampling_hz)
    dt = 1.0 / sampling_hz

    time_series = []
    for i in range(total_samples):
        t = i * dt
        # Primary sinusoidal breathing wave
        wave = 0.5 + 0.02 * math.sin(2 * math.pi * freq_hz * t)
        # Slow baseline wander (0.03 Hz)
        baseline = 0.005 * math.sin(2 * math.pi * 0.03 * t)
        # High frequency jitter
        jitter = noise_amplitude * math.sin(2 * math.pi * 3.5 * t)
        y = wave + baseline + jitter
        time_series.append((t, y))

    return time_series


def test_breathing_rate_normal_16bpm():
    """Simulated 16 breaths/min over 30 seconds should estimate close to 16 bpm."""
    series = generate_synthetic_respiration(rate_bpm=16.0, duration_sec=30.0)
    result = estimate_breathing_rate(series, window_seconds=30.0)

    assert result["breathing_rate"] is not None
    # Estimated rate within ±2 bpm of 16.0
    assert 14.0 <= result["breathing_rate"] <= 18.0
    assert result["confidence"] in ("high", "medium")
    assert result["label"] == "Estimate, not a clinical measurement"


def test_breathing_rate_tachypnea_26bpm():
    """Simulated rapid breathing (tachypnea, 26 bpm) over 30s window."""
    series = generate_synthetic_respiration(rate_bpm=26.0, duration_sec=30.0)
    result = estimate_breathing_rate(series, window_seconds=30.0)

    assert result["breathing_rate"] is not None
    assert 23.0 <= result["breathing_rate"] <= 29.0
    assert result["label"] == "Estimate, not a clinical measurement"


def test_breathing_rate_short_window_prompts_hold_still():
    """Incomplete window (< 15 seconds) must prompt 'Hold still for 30 seconds' and low confidence."""
    short_series = generate_synthetic_respiration(rate_bpm=16.0, duration_sec=10.0)
    result = estimate_breathing_rate(short_series, window_seconds=30.0)

    assert result["confidence"] == "low"
    assert "Hold still" in result["prompt"]


def test_posture_estimation():
    """Shoulder tilt and head forward posture labels."""
    # Level shoulders
    left = (0.4, 0.45)
    right = (0.6, 0.45)
    ear = (0.5, 0.35)
    posture = estimate_posture(left, right, ear)
    assert "Level" in posture["shoulder_tilt_label"]
    assert "Neutral" in posture["head_forward_label"]
    assert posture["label"] == "Estimate, not a clinical measurement"

    # Tilted shoulders
    left_tilted = (0.4, 0.42)
    right_tilted = (0.6, 0.49)
    posture_tilted = estimate_posture(left_tilted, right_tilted)
    assert "tilt" in posture_tilted["shoulder_tilt_label"].lower()


def test_vitals_mismatch_rule_severe_breathlessness_normal_measured():
    """
    Mismatch rule:
    Patient reports severe breathlessness (8/10), but video measures normal rate (16 bpm).
    Must trigger RF-10 warning and state that video cannot rule out compromise.
    Must NEVER say the patient is fine.
    """
    mismatch = evaluate_vitals_mismatch(
        patient_reported_severity=8,
        breathing_rate=16.0,
        confidence="high"
    )
    assert mismatch is not None
    assert mismatch["id"] == "RF-10"
    assert "Discordant" in mismatch["name"]
    assert "cannot rule out" in mismatch["message"].lower()
    # Ensure it never claims patient is fine
    assert "patient is fine" not in mismatch["message"].lower()
    assert "no problem" not in mismatch["message"].lower()


def test_vitals_mismatch_low_confidence_signal():
    """Severe breathlessness with low confidence signal triggers RF-10 warning."""
    mismatch = evaluate_vitals_mismatch(
        patient_reported_severity=9,
        breathing_rate=None,
        confidence="low"
    )
    assert mismatch is not None
    assert mismatch["id"] == "RF-10"
    assert "signal quality is low" in mismatch["message"]
