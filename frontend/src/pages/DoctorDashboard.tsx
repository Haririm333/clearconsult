import React from 'react';
import {
  CheckCircle2,
  HelpCircle,
  AlertOctagon,
  Quote,
  ShieldAlert,
  RefreshCw,
  Sparkles,
  FileText,
  Camera,
  BookOpen
} from 'lucide-react';
import type { SessionState, ExtractedField, ItemSource } from '../types';
import { loadTamilDemoScenario, resetSession } from '../api';
import { DoctorNotePanel } from '../components/DoctorNotePanel';
import { VideoConsultation } from '../components/VideoConsultation';
import { VitalsEstimator } from '../components/VitalsEstimator';

interface DoctorDashboardProps {
  sessionId: string;
  sessionState: SessionState | null;
  onRefresh: () => void;
  isLoading?: boolean;
  onOpenGuides?: () => void;
  onOpenSkinTriage?: () => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({
  sessionId,
  sessionState,
  onRefresh,
  isLoading,
  onOpenGuides,
  onOpenSkinTriage
}) => {
  const fields = sessionState?.extracted_fields;
  const needsAttention = sessionState?.needs_attention || [];
  const conversation = sessionState?.conversation_history || [];

  // Helper to render source badge
  const renderSourceChip = (source: ItemSource) => {
    switch (source) {
      case 'patient said':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-[4px] bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1]">
            <Quote className="w-2.5 h-2.5 text-[#0f766e]" />
            <span>patient said</span>
          </span>
        );
      case 'measured':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-[4px] bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]">
            <span>measured (estimate)</span>
          </span>
        );
      case 'inferred':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-[4px] bg-[#f8faf9] text-[#64748b] border border-[#e2e8f0]">
            <span>inferred</span>
          </span>
        );
    }
  };

  // Helper to format known values
  const formatValue = (val: any) => {
    if (val === null || val === undefined || val === '') return 'Not reported';
    if (Array.isArray(val)) {
      if (val.length === 0) return 'None recorded';
      return val.join(', ');
    }
    return String(val);
  };

  // Separate known vs unknown
  const fieldList: { key: string; label: string; field: ExtractedField }[] = fields
    ? [
        { key: 'chief_complaint', label: 'Chief Complaint', field: fields.chief_complaint },
        { key: 'duration', label: 'Duration', field: fields.duration },
        { key: 'onset', label: 'Onset', field: fields.onset },
        { key: 'severity', label: 'Severity (0-10)', field: fields.severity },
        { key: 'associated_symptoms', label: 'Associated Symptoms', field: fields.associated_symptoms },
        { key: 'relevant_negatives', label: 'Relevant Negatives', field: fields.relevant_negatives },
        { key: 'medications', label: 'Medications', field: fields.medications }
      ]
    : [];

  const knownItems = fieldList.filter((item) => item.field?.status === 'known');
  const unknownItems = fieldList.filter((item) => item.field?.status !== 'known');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full">
      {/* Top Clinical Triage Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-[6px] border border-[#e2e8f0] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-[#0f172a] tracking-tight">
              Clinician Uncertainty & Missing Information Monitor
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
              Session: {sessionId}
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5">
            ClearConsult distinguishes patient facts, clinical uncertainty, and deterministic red flag warnings. The clinician always decides.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadTamilDemoScenario(sessionId).then(onRefresh)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-medium transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Run Tamil Acceptance Scenario</span>
          </button>
          <button
            onClick={() => resetSession(sessionId).then(onRefresh)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border border-[#cbd5e1] hover:bg-[#f8faf9] text-[#475569] text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Reset</span>
          </button>
          {onOpenSkinTriage && (
            <button
              onClick={onOpenSkinTriage}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border border-[#99f6e4] hover:bg-[#f0fdfa] text-[#0f766e] text-xs font-medium transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Skin Triage</span>
            </button>
          )}
          {onOpenGuides && (
            <button
              onClick={onOpenGuides}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border border-[#cbd5e1] hover:bg-[#f8faf9] text-[#475569] text-xs font-medium transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Guides</span>
            </button>
          )}
        </div>
      </div>

      {/* Emergency Alert Banner if present */}
      {sessionState?.is_emergency && (
        <div className="mb-6 p-4 rounded-[6px] bg-[#fef2f2] border border-[#fca5a5] text-[#991b1b] flex items-start gap-3 shadow-xs">
          <AlertOctagon className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm">CRITICAL EMERGENCY DETECTED (RULE: SAFETY-EMERGENCY-112)</h2>
            </div>
            <p className="text-xs mt-1 text-[#7f1d1d]">
              {sessionState.emergency_alert?.alert_message ||
                'Patient reported life-threatening symptoms. Immediate emergency transfer / 112 escalation recommended.'}
            </p>
          </div>
        </div>
      )}

      {/* Two Column Layout: Left = Video / Transcript, Right = Three-State Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (4 cols): Video call feed placeholder & conversation transcript */}
        <div className="lg:col-span-4 space-y-4">
          {/* Phase 3: Video Consultation Stream */}
          <VideoConsultation role="doctor" sessionId={sessionId} />

          {/* Phase 4: Vitals Estimates (Breathing Rate, Posture, Mismatch Rule) */}
          <VitalsEstimator patientReportedSeverity={sessionState?.extracted_fields?.severity?.severity_num || 8} />

          {/* Patient Raw Utterance Audit Stream */}
          <div className="bg-white border border-[#e2e8f0] rounded-[6px] shadow-xs overflow-hidden">
            <div className="bg-[#f8faf9] border-b border-[#e2e8f0] px-3.5 py-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#0f172a] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#0f766e]" />
                <span>Patient Utterances & Transcript</span>
              </span>
              <span className="text-[10px] text-[#64748b] tabular-nums font-mono">
                {conversation.length} events
              </span>
            </div>
            <div className="p-3 max-h-72 overflow-y-auto space-y-2 text-xs bg-[#fafcfb]">
              {conversation.length === 0 ? (
                <p className="text-xs text-[#94a3b8] italic text-center py-4">
                  No conversation events recorded yet.
                </p>
              ) : (
                conversation.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-[4px] border ${
                      msg.role === 'patient'
                        ? 'bg-white border-[#cbd5e1] text-[#0f172a]'
                        : 'bg-[#f0fdfa] border-[#ccfbf1] text-[#0f766e]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#64748b] mb-1">
                      <span className="font-semibold uppercase tracking-wider">
                        {msg.role === 'patient' ? 'Patient Utterance' : 'ClearConsult Follow-Up'}
                      </span>
                    </div>
                    <div className="leading-relaxed">{msg.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (8 cols): The 3-State Panel (KNOWN, UNKNOWN, NEEDS ATTENTION) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section Summary Counters */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-[#cbd5e1] rounded-[6px] p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#475569] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0f766e]" />
                  <span>KNOWN</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-[#0f766e]">
                  {knownItems.length}
                </span>
              </div>
              <p className="text-[11px] text-[#64748b] mt-1">Stated by patient or measured</p>
            </div>

            <div className="bg-white border border-[#cbd5e1] rounded-[6px] p-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#475569] flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-[#64748b]" />
                  <span>UNKNOWN</span>
                </span>
                <span className="text-sm font-semibold tabular-nums text-[#475569]">
                  {unknownItems.length}
                </span>
              </div>
              <p className="text-[11px] text-[#64748b] mt-1">Gaps not yet asked or answered</p>
            </div>

            <div
              className={`rounded-[6px] p-3 shadow-xs border ${
                needsAttention.length > 0
                  ? 'bg-[#fef2f2] border-[#fca5a5]'
                  : 'bg-white border-[#cbd5e1]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#b91c1c] flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#dc2626]" />
                  <span>NEEDS ATTENTION</span>
                </span>
                <span className="text-sm font-bold tabular-nums text-[#b91c1c]">
                  {needsAttention.length}
                </span>
              </div>
              <p className="text-[11px] text-[#7f1d1d] mt-1">Deterministic red flag rules</p>
            </div>
          </div>

          {/* SECTION 1: NEEDS ATTENTION (Top priority) */}
          <div className="bg-white border border-[#fca5a5] rounded-[6px] shadow-xs overflow-hidden">
            <div className="bg-[#fef2f2] border-b border-[#fca5a5] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#dc2626] animate-pulse"></div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#991b1b] flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-[#dc2626]" />
                  <span>State: NEEDS ATTENTION</span>
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-[#991b1b] px-2 py-0.5 rounded bg-[#fee2e2] border border-[#fecaca]">
                Deterministic Rule Engine Only
              </span>
            </div>

            <div className="p-4 space-y-3">
              {needsAttention.length === 0 ? (
                <div className="p-6 text-center text-[#94a3b8] text-xs">
                  <CheckCircle2 className="w-6 h-6 text-[#10b981] mx-auto mb-1.5 opacity-80" />
                  <p className="font-medium text-[#334155]">No red flags triggered</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">
                    None of the 10 deterministic warning rules matched current patient statements.
                  </p>
                </div>
              ) : (
                needsAttention.map((alert, idx) => (
                  <div
                    key={idx}
                    className="border border-[#fca5a5] bg-white rounded-[6px] p-3.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#fef2f2] text-[#b91c1c] border border-[#fca5a5]">
                          {alert.id}
                        </span>
                        <h3 className="font-semibold text-xs text-[#0f172a] tracking-tight">
                          {alert.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#fef3c7] text-[#92400e] border border-[#fde68a] font-semibold">
                        {alert.source}
                      </span>
                    </div>

                    <p className="text-xs text-[#7f1d1d] font-medium mt-2 leading-relaxed bg-[#fff5f5] p-2.5 rounded-[4px] border border-[#fecaca]">
                      {alert.message}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#64748b]">
                      <span>Source: Deterministic Rule Engine</span>
                      <span className="font-semibold text-[#b91c1c] uppercase tracking-wider">
                        {alert.severity_level}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 2: KNOWN ITEMS */}
          <div className="bg-white border border-[#cbd5e1] rounded-[6px] shadow-xs overflow-hidden">
            <div className="bg-[#f8faf9] border-b border-[#cbd5e1] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0f766e]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0f766e]">
                  State: KNOWN (Stated or Measured)
                </h2>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-[#64748b]">
                {knownItems.length} verified fields
              </span>
            </div>

            <div className="divide-y divide-[#f1f5f9]">
              {knownItems.length === 0 ? (
                <div className="p-6 text-center text-[#94a3b8] text-xs">
                  <p className="font-medium text-[#475569]">No known fields yet</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5">
                    Items will appear here as the patient confirms them.
                  </p>
                </div>
              ) : (
                knownItems.map(({ key, label, field }) => (
                  <div key={key} className="p-3.5 hover:bg-[#fafcfb] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#0f172a]">{label}</span>
                          {renderSourceChip(field.source)}
                        </div>
                        <div className="text-xs text-[#0f766e] font-medium mt-1">
                          {formatValue(field.value)}
                        </div>
                      </div>
                    </div>

                    {/* Exact patient quotation / evidence */}
                    {field.evidence && (
                      <div className="mt-2 bg-[#f8faf9] border-l-2 border-[#0f766e] px-2.5 py-1.5 rounded-r-[4px] text-[11px] text-[#475569]">
                        <span className="font-semibold text-[#334155]">Patient's exact words: </span>
                        <span className="italic text-[#0f172a]">"{field.evidence}"</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION 3: UNKNOWN ITEMS (GAPS) */}
          <div className="bg-white border border-[#cbd5e1] rounded-[6px] shadow-xs overflow-hidden">
            <div className="bg-[#f8faf9] border-b border-[#cbd5e1] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#64748b]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                  State: UNKNOWN (Clinical Gaps)
                </h2>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-[#64748b]">
                {unknownItems.length} open gaps
              </span>
            </div>

            <div className="divide-y divide-[#f1f5f9]">
              {unknownItems.length === 0 ? (
                <div className="p-6 text-center text-[#166534] bg-[#f0fdf4] text-xs">
                  <CheckCircle2 className="w-5 h-5 text-[#16a34a] mx-auto mb-1" />
                  <p className="font-semibold">All primary clinical fields resolved</p>
                </div>
              ) : (
                unknownItems.map(({ key, label, field }, index) => {
                  const isCurrentTarget = sessionState?.highest_priority_unknown?.field === key;
                  return (
                    <div
                      key={key}
                      className={`p-3.5 transition-colors ${
                        isCurrentTarget ? 'bg-[#f0fdfa]/50 border-l-4 border-[#0f766e]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">
                            P{index + 1}
                          </span>
                          <span className="text-xs font-medium text-[#334155]">{label}</span>
                          {renderSourceChip(field.source)}
                        </div>

                        {isCurrentTarget && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#ccfbf1] text-[#0f766e] border border-[#99f6e4]">
                            Currently Asking
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-[#64748b] mt-1 flex items-center justify-between">
                        <span>
                          {field.prompt_hint || 'Awaiting patient response or clinical inquiry'}
                        </span>
                        <span className="text-[10px] text-[#94a3b8] italic">Unanswered</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SECTION 4: STRUCTURED CONSULTATION NOTE & PDF EXPORT */}
          <DoctorNotePanel sessionId={sessionId} onNoteConfirmed={onRefresh} />
        </div>
      </div>
    </div>
  );
};
