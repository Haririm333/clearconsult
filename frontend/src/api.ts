import type {
  SessionState,
  DoctorRecord,
  ConsultResponse,
  WaitingPatientItem,
  WebRTCConfig
} from './types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export async function getSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch session: ${res.statusText}`);
  }
  return res.json();
}

export async function resetSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/reset`, {
    method: 'POST'
  });
  if (!res.ok) {
    throw new Error(`Failed to reset session: ${res.statusText}`);
  }
  return res.json();
}

export async function extractMissingInfo(
  sessionId: string,
  latestInput: string,
  language: string,
  history: { role: string; text: string }[],
  skippedFields: string[] = []
): Promise<any> {
  const res = await fetch(`${API_BASE}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      conversation_history: history,
      latest_input: latestInput,
      language: language,
      skipped_fields: skippedFields
    })
  });
  if (!res.ok) {
    throw new Error(`Extraction failed: ${res.statusText}`);
  }
  return res.json();
}

export async function skipField(sessionId: string, field: string): Promise<SessionState> {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field })
  });
  if (!res.ok) {
    throw new Error(`Skip field failed: ${res.statusText}`);
  }
  return res.json();
}

export async function loadTamilDemoScenario(sessionId: string = 'demo-tamil-session'): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/load-tamil?session_id=${encodeURIComponent(sessionId)}`, {
    method: 'POST'
  });
  if (!res.ok) {
    throw new Error(`Failed to load Tamil demo: ${res.statusText}`);
  }
  return res.json();
}

export async function getRules(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/rules`);
  if (!res.ok) {
    throw new Error('Failed to fetch rules');
  }
  return res.json();
}

// =========================================================================
// PHASE 2 API CALLS
// =========================================================================

export async function getDoctorNote(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/doctor-note`);
  if (!res.ok) {
    throw new Error('Failed to fetch doctor note');
  }
  return res.json();
}

export async function updateDoctorNote(sessionId: string, noteData: any): Promise<any> {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/doctor-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData)
  });
  if (!res.ok) {
    throw new Error('Failed to update doctor note');
  }
  return res.json();
}

export async function confirmDoctorNote(
  sessionId: string,
  doctorName: string = 'Attending Clinician (Dr. Verified)',
  doctorInstructions?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/doctor-note/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      doctor_name: doctorName,
      doctor_instructions: doctorInstructions
    })
  });
  if (!res.ok) {
    throw new Error('Failed to confirm doctor note');
  }
  return res.json();
}

export async function getPatientInstructions(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/patient-instructions`);
  if (!res.ok) {
    throw new Error('Failed to fetch patient instructions');
  }
  return res.json();
}

export function getExportPdfUrl(sessionId: string): string {
  return `${API_BASE}/session/${encodeURIComponent(sessionId)}/export-pdf`;
}

// =========================================================================
// Multi-Consultation & Queue API
// =========================================================================

export async function registerDoctor(
  id: string,
  name: string,
  specialty: string = 'General Medicine'
): Promise<DoctorRecord> {
  const res = await fetch(`${API_BASE}/doctors/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, specialty })
  });
  if (!res.ok) {
    throw new Error('Failed to register doctor');
  }
  return res.json();
}

export async function sendDoctorHeartbeat(id: string): Promise<DoctorRecord> {
  const res = await fetch(`${API_BASE}/doctors/${encodeURIComponent(id)}/heartbeat`, {
    method: 'POST'
  });
  if (!res.ok) {
    throw new Error('Failed to send heartbeat');
  }
  return res.json();
}

export async function listDoctors(): Promise<DoctorRecord[]> {
  const res = await fetch(`${API_BASE}/doctors`);
  if (!res.ok) {
    throw new Error('Failed to list doctors');
  }
  return res.json();
}

export async function getDoctorRecentSessions(id: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/doctors/${encodeURIComponent(id)}/sessions`);
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function requestConsultation(
  sessionId: string,
  patientId?: string,
  patientName?: string,
  language: string = 'en'
): Promise<ConsultResponse> {
  const res = await fetch(`${API_BASE}/consults`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      patient_id: patientId,
      patient_name: patientName,
      language
    })
  });
  if (!res.ok) {
    throw new Error('Failed to request consultation');
  }
  return res.json();
}

export async function getConsultStatus(sessionId: string): Promise<ConsultResponse> {
  const res = await fetch(`${API_BASE}/consults/${encodeURIComponent(sessionId)}/status`);
  if (!res.ok) {
    throw new Error('Failed to fetch consult status');
  }
  return res.json();
}

export async function getWaitingQueue(): Promise<WaitingPatientItem[]> {
  const res = await fetch(`${API_BASE}/consults/queue`);
  if (!res.ok) {
    throw new Error('Failed to fetch waiting queue');
  }
  return res.json();
}

export async function acceptPatient(sessionId: string, doctorId: string): Promise<ConsultResponse> {
  const res = await fetch(`${API_BASE}/consults/${encodeURIComponent(sessionId)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctor_id: doctorId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to accept patient');
  }
  return res.json();
}

export async function startCall(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/consults/${encodeURIComponent(sessionId)}/start`, {
    method: 'POST'
  });
  if (!res.ok) {
    throw new Error('Failed to start call');
  }
  return res.json();
}

export async function endConsultation(sessionId: string, reason: string = 'completed'): Promise<any> {
  const res = await fetch(`${API_BASE}/consults/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  if (!res.ok) {
    throw new Error('Failed to end consultation');
  }
  return res.json();
}

export async function getWebRTCConfig(): Promise<WebRTCConfig> {
  const res = await fetch(`${API_BASE}/config/webrtc`);
  if (!res.ok) {
    return {
      ice_servers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }
  return res.json();
}

export async function seedMultiRoomDemo(): Promise<any> {
  const res = await fetch(`${API_BASE}/demo/seed-multi-room`, {
    method: 'POST'
  });
  if (!res.ok) {
    throw new Error('Failed to seed multi-room demo');
  }
  return res.json();
}

