"""
Clinical Vitals Estimation: Breathing Rate & Posture.
All values are strictly labeled ESTIMATE.
Features:
- 30-second window vertical motion tracking
- Band-pass filtering (0.15 - 0.55 Hz -> 9 to 33 breaths/min)
- Peak counting with prominence and minimum distance
- Confidence calculation (low, medium, high based on noise and motion artifact)
- Posture angles (shoulder tilt, head forward tilt)
- Mismatch rule evaluator (RF-10)
"""

import math
from typing import List, Tuple, Dict, Any, Optional


def bandpass_filter_1d(
    signal: List[float],
    dt: float = 0.1,
    low_freq: float = 0.15,
    high_freq: float = 0.55
) -> List[float]:
    """
    Simple Moving-Average subtraction (high-pass) followed by
    low-pass smoothing to isolate physiological respiratory band (0.15 - 0.55 Hz).
    """
    n = len(signal)
    if n < 5:
        return signal

    # 1. High-pass: Subtract long-term moving trend (period ~ 6s)
    trend_window = max(3, int(6.0 / dt))
    filtered_hp = []
    half_w = trend_window // 2
    for i in range(n):
        start = max(0, i - half_w)
        end = min(n, i + half_w + 1)
        mean_val = sum(signal[start:end]) / (end - start)
        filtered_hp.append(signal[i] - mean_val)

    # 2. Low-pass: Short moving average to eliminate high frequency noise (period ~ 1.5s)
    smooth_window = max(2, int(1.2 / dt))
    filtered = []
    half_s = smooth_window // 2
    for i in range(n):
        start = max(0, i - half_s)
        end = min(n, i + half_s + 1)
        filtered.append(sum(filtered_hp[start:end]) / (end - start))

    return filtered


def detect_peaks(
    signal: List[float],
    dt: float = 0.1,
    min_distance_seconds: float = 1.8,
    min_prominence: float = 0.0015
) -> List[int]:
    """
    Detects respiratory cycle peaks (local maxima) with refractory minimum distance.
    """
    peaks = []
    min_dist_samples = int(min_distance_seconds / dt)
    n = len(signal)
    last_peak = -min_dist_samples

    for i in range(1, n - 1):
        if signal[i] > signal[i - 1] and signal[i] >= signal[i + 1]:
            if (i - last_peak) >= min_dist_samples:
                # Check prominence relative to immediate neighbors
                left_valley = min(signal[max(0, i - min_dist_samples):i])
                right_valley = min(signal[i + 1:min(n, i + min_dist_samples + 1)])
                prominence = signal[i] - max(left_valley, right_valley)
                if prominence >= min_prominence:
                    peaks.append(i)
                    last_peak = i

    return peaks


def estimate_breathing_rate(
    time_series: List[Tuple[float, float]],
    window_seconds: float = 30.0
) -> Dict[str, Any]:
    """
    Estimates respiratory rate from vertical motion of chest/shoulder landmarks.
    time_series: list of (timestamp_seconds, vertical_y)
    Returns:
      - breathing_rate: breaths per minute (estimate)
      - confidence: 'low' | 'medium' | 'high'
      - peak_count: int
      - window_duration: float
      - prompt: 'Hold still for 30 seconds' if incomplete window
      - label: 'Estimate, not a clinical measurement'
    """
    if not time_series or len(time_series) < 10:
        return {
            "breathing_rate": None,
            "confidence": "low",
            "peak_count": 0,
            "window_duration": 0.0,
            "prompt": "Hold still for 30 seconds",
            "label": "Estimate, not a clinical measurement"
        }

    # Filter to window_seconds
    latest_t = time_series[-1][0]
    cutoff_t = latest_t - window_seconds
    windowed = [pt for pt in time_series if pt[0] >= cutoff_t]

    if len(windowed) < 10:
        return {
            "breathing_rate": None,
            "confidence": "low",
            "peak_count": 0,
            "window_duration": 0.0,
            "prompt": "Hold still for 30 seconds",
            "label": "Estimate, not a clinical measurement"
        }

    timestamps = [pt[0] for pt in windowed]
    values = [pt[1] for pt in windowed]
    duration = timestamps[-1] - timestamps[0]

    # Approximate sampling interval
    dt = duration / (len(timestamps) - 1) if len(timestamps) > 1 else 0.1
    if dt <= 0:
        dt = 0.1

    # Bandpass filter
    filtered = bandpass_filter_1d(values, dt=dt)

    # Detect peaks
    peaks = detect_peaks(filtered, dt=dt)
    peak_count = len(peaks)

    # Check motion artifact variance (excessive movement degrades confidence)
    raw_diffs = [abs(values[i] - values[i - 1]) for i in range(1, len(values))]
    avg_jitter = sum(raw_diffs) / len(raw_diffs) if raw_diffs else 0.0

    # Confidence calculation
    if duration < 20.0 or avg_jitter > 0.05:
        confidence = "low"
    elif duration >= 25.0 and peak_count >= 5 and avg_jitter < 0.02:
        confidence = "high"
    else:
        confidence = "medium"

    # Rate calculation: breaths per minute
    if duration > 5.0 and peak_count > 0:
        # Scale to 60 seconds
        rate = round((peak_count / duration) * 60.0, 1)
        # Cap to physiological range 6 - 45
        rate = max(6.0, min(45.0, rate))
    else:
        rate = None

    prompt = "Hold still for 30 seconds" if duration < 28.0 else "Measurement window complete"

    return {
        "breathing_rate": rate,
        "confidence": confidence,
        "peak_count": peak_count,
        "window_duration": round(duration, 1),
        "prompt": prompt,
        "label": "Estimate, not a clinical measurement"
    }


def estimate_posture(
    left_shoulder: Tuple[float, float],
    right_shoulder: Tuple[float, float],
    ear: Optional[Tuple[float, float]] = None
) -> Dict[str, Any]:
    """
    Estimates shoulder tilt and head-forward posture from coordinates.
    All coordinates normalized [0, 1].
    """
    dx = right_shoulder[0] - left_shoulder[0]
    dy = right_shoulder[1] - left_shoulder[1]

    # Tilt angle in degrees
    tilt_rad = math.atan2(dy, dx)
    tilt_deg = abs(math.degrees(tilt_rad))

    if tilt_deg < 3.5:
        shoulder_label = "Level (Neutral)"
    elif tilt_deg < 8.0:
        shoulder_label = "Mild shoulder tilt"
    else:
        shoulder_label = "Marked shoulder tilt"

    # Head forward estimate (angle relative to vertical)
    head_label = "Neutral upright"
    if ear:
        mid_shoulder_x = (left_shoulder[0] + right_shoulder[0]) / 2.0
        mid_shoulder_y = (left_shoulder[1] + right_shoulder[1]) / 2.0
        head_dx = ear[0] - mid_shoulder_x
        head_dy = mid_shoulder_y - ear[1] # upward
        head_angle = abs(math.degrees(math.atan2(head_dx, head_dy)))
        if head_angle < 12.0:
            head_label = "Neutral upright"
        elif head_angle < 22.0:
            head_label = "Mild head-forward tilt"
        else:
            head_label = "Significant head-forward posture"

    return {
        "shoulder_tilt_degrees": round(tilt_deg, 1),
        "shoulder_tilt_label": shoulder_label,
        "head_forward_label": head_label,
        "label": "Estimate, not a clinical measurement"
    }


def evaluate_vitals_mismatch(
    patient_reported_severity: Optional[int],
    breathing_rate: Optional[float],
    confidence: str
) -> Optional[Dict[str, Any]]:
    """
    Mismatch rule:
    If the patient reports severe breathlessness (severity >= 7) and
    measured rate is normal (12-20 bpm), or the signal is poor (low confidence),
    add a Needs attention item stating that video cannot confirm it.
    Never say the patient is fine.
    """
    if patient_reported_severity is not None and patient_reported_severity >= 7:
        if confidence == "low":
            return {
                "id": "RF-10",
                "name": "Discordant / Unverified Respiratory Status",
                "message": (
                    "Severe breathlessness reported by patient, but video vitals signal quality is low. "
                    "Video cannot rule out respiratory compromise; direct clinical assessment required."
                ),
                "source": "DRAFT - requires clinician review",
                "severity_level": "warning"
            }
        elif breathing_rate is not None and 12.0 <= breathing_rate <= 20.0:
            return {
                "id": "RF-10",
                "name": "Discordant Respiratory Status (Reported vs Measured)",
                "message": (
                    f"Patient reports severe breathlessness (severity {patient_reported_severity}/10), "
                    f"but measured breathing rate appears normal ({breathing_rate} bpm). "
                    "Video cannot rule out respiratory distress; do not assume patient is comfortable."
                ),
                "source": "DRAFT - requires clinician review",
                "severity_level": "warning"
            }
    return None
