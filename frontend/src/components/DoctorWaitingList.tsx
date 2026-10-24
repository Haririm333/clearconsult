import React from 'react';
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import type { WaitingPatientItem } from '../types';

interface DoctorWaitingListProps {
  queue: WaitingPatientItem[];
  doctorId: string;
  isDoctorAvailable: boolean;
  onAcceptPatient: (sessionId: string) => void;
  onSeedDemo: () => void;
  isLoading?: boolean;
}

export const DoctorWaitingList: React.FC<DoctorWaitingListProps> = ({
  queue,
  isDoctorAvailable,
  onAcceptPatient,
  onSeedDemo,
  isLoading
}) => {
  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s wait`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s wait`;
  };

  return (
    <div className="bg-white border border-[#cbd5e1] rounded-[6px] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="bg-[#f8faf9] border-b border-[#cbd5e1] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0f766e]" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0f172a] flex items-center gap-2">
              <span>Patient Triage Waiting Queue</span>
              <span className="px-2 py-0.5 rounded-[10px] bg-[#0f766e]/10 text-[#0f766e] text-[10px] font-mono font-bold">
                {queue.length} waiting
              </span>
            </h2>
            <p className="text-[11px] text-[#64748b]">
              Automatic FIFO matching or manual priority acceptance. Clinician always decides.
            </p>
          </div>
        </div>

        <button
          onClick={onSeedDemo}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] bg-[#f0fdfa] border border-[#99f6e4] text-[#0f766e] hover:bg-[#ccfbf1] text-xs font-semibold transition-colors shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Demo Seed (4 Queued Patients)</span>
        </button>
      </div>

      {/* Queue Items */}
      {queue.length === 0 ? (
        <div className="p-8 text-center text-[#64748b] bg-[#fafcfb]">
          <div className="w-12 h-12 rounded-full bg-[#f1f5f9] text-[#94a3b8] flex items-center justify-center mx-auto mb-2 border border-[#e2e8f0]">
            <CheckCircle2 className="w-6 h-6 text-[#16a34a]" />
          </div>
          <p className="text-sm font-semibold text-[#0f172a]">The waiting queue is currently clear</p>
          <p className="text-xs text-[#64748b] mt-1 max-w-sm mx-auto">
            You will be automatically matched when the next patient requests a consultation, or click below to populate mock presentation patients.
          </p>
          <button
            onClick={onSeedDemo}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#0f766e] text-white text-xs font-medium hover:bg-[#115e59] transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Presentation Queue</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#e2e8f0]">
          {queue.map((patient, index) => {
            const hasRedFlags = patient.needs_attention && patient.needs_attention.length > 0;
            return (
              <div
                key={patient.session_id}
                className={`p-4 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  hasRedFlags ? 'bg-[#fffbfb] hover:bg-[#fff5f5]' : 'bg-white hover:bg-[#f8faf9]'
                }`}
              >
                {/* Left: Patient Info & Clinical Complaint */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-5 h-5 rounded-full bg-[#0f172a] text-white text-[10px] font-bold flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <span className="text-sm font-bold text-[#0f172a]">
                      {patient.patient_name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#475569] font-medium bg-[#f1f5f9] px-2 py-0.5 rounded-[4px] border border-[#cbd5e1]">
                      <Clock className="w-3 h-3 text-[#64748b]" />
                      <span>{formatWaitTime(patient.wait_seconds)}</span>
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300">
                      {patient.language === 'ta' ? 'தமிழ்' : patient.language === 'hi' ? 'हिन्दी' : 'EN'}
                    </span>
                  </div>

                  {/* Chief Complaint */}
                  <p className="text-xs text-[#334155] line-clamp-2 italic bg-white/70 p-2 rounded-[4px] border border-[#e2e8f0]">
                    "{patient.chief_complaint || 'No complaint details provided.'}"
                  </p>

                  {/* Needs Attention Warning Badges */}
                  {hasRedFlags && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#b91c1c] flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-[#dc2626]" />
                        <span>Needs Attention:</span>
                      </span>
                      {patient.needs_attention.map((rf) => (
                        <span
                          key={rf.id}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-[#fef2f2] text-[#991b1b] border border-[#fca5a5]"
                          title={rf.message}
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-[#dc2626]" />
                          <span>[{rf.id}] {rf.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Manual Accept Button */}
                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                  <button
                    onClick={() => onAcceptPatient(patient.session_id)}
                    disabled={isLoading || !isDoctorAvailable}
                    title={!isDoctorAvailable ? 'Clinician is busy or offline. Set to Available to accept.' : 'Accept patient into your room'}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[4px] text-xs font-semibold transition-colors shadow-xs w-full md:w-auto ${
                      isLoading || !isDoctorAvailable
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                        : 'bg-[#0f766e] hover:bg-[#115e59] text-white cursor-pointer'
                    }`}
                  >
                    <span>Accept Patient</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
