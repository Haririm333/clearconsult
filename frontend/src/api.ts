import type { SessionState } from './types';

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
