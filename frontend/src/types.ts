export type FieldStatus = "known" | "unknown";
export type ItemSource = "patient said" | "measured" | "inferred";
export type SeverityLevel = "critical" | "warning";

export interface ExtractedField {
  value: any;
  status: FieldStatus;
  evidence: string | null;
  source: ItemSource;
  prompt_hint?: string;
  severity_num?: number;
}

export interface ExtractedFieldsContainer {
  chief_complaint: ExtractedField;
  onset: ExtractedField;
  duration: ExtractedField;
  severity: ExtractedField;
  associated_symptoms: ExtractedField;
  relevant_negatives: ExtractedField;
  medications: ExtractedField;
}

export interface NextQuestion {
  field: string;
  question: string;
  question_en?: string;
}

export interface NeedsAttentionItem {
  id: string;
  name: string;
  message: string;
  source: string;
  severity_level: SeverityLevel;
}

export interface ChatMessage {
  role: "patient" | "system";
  text: string;
  timestamp?: number;
}

export interface SessionState {
  session_id: string;
  language: string;
  conversation_history: ChatMessage[];
  extracted_fields: ExtractedFieldsContainer;
  highest_priority_unknown: NextQuestion | null;
  needs_attention: NeedsAttentionItem[];
  is_emergency: boolean;
  emergency_alert?: {
    is_emergency: boolean;
    alert_message: string;
    alert_message_ta?: string;
    alert_message_hi?: string;
    rule_id: string;
  } | null;
  skipped_fields: string[];
  all_key_fields_known?: boolean;
  vitals?: {
    breathing_rate: number | null;
    confidence: string;
    posture_shoulder_tilt: number | null;
    head_forward_angle: number | null;
    status_label: string;
  };
  doctor_note?: {
    complaint: string;
    timeline: string;
    severity: string;
    associated_symptoms: string;
    gaps_open: string;
    confirmed: boolean;
    confirmed_at: number | null;
  };
  peer_ids?: {
    doctor: string | null;
    patient: string | null;
  };
  created_at: number;
  updated_at: number;
}
