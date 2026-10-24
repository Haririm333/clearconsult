import React from 'react';
import {
  Activity,
  User,
  Stethoscope,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  AlertOctagon
} from 'lucide-react';
import { loadTamilDemoScenario } from '../api';

interface HomeProps {
  sessionId: string;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
}

export const Home: React.FC<HomeProps> = ({ sessionId, onNavigate, onRefresh }) => {
  const handleLaunchTamilDemo = async () => {
    try {
      await loadTamilDemoScenario(sessionId);
      onRefresh();
      onNavigate('/doctor');
    } catch (e) {
      console.error(e);
      onNavigate('/doctor');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full">
      {/* Hero */}
      <div className="bg-white border border-[#e2e8f0] rounded-[6px] p-8 shadow-xs text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-[#f0fdfa] border border-[#99f6e4] text-[#0f766e] text-xs font-semibold uppercase tracking-wider mb-4">
          <Activity className="w-4 h-4" />
          <span>ClearConsult Telemedicine Prototype</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-[#0f172a] sm:text-4xl">
          Clinical Uncertainty & Missing Information Detector
        </h1>

        <p className="mt-3 text-sm text-[#475569] max-w-2xl mx-auto leading-relaxed">
          ClearConsult sits inside a video consultation. It never diagnoses. It classifies patient statements into three explicit states for the clinician: <strong>Known</strong>, <strong>Unknown</strong>, and <strong>Needs Attention</strong>.
        </p>

        {/* 3 Core States Card */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-3xl mx-auto">
          <div className="border border-[#cbd5e1] rounded-[6px] p-4 bg-[#f8faf9]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0f766e] uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>1. KNOWN</span>
            </div>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Facts stated directly by the patient or measured, with verbatim quotes as evidence.
            </p>
          </div>

          <div className="border border-[#cbd5e1] rounded-[6px] p-4 bg-[#f8faf9]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
              <HelpCircle className="w-4 h-4" />
              <span>2. UNKNOWN</span>
            </div>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Important diagnostic gaps not yet asked or answered, prioritized one question at a time.
            </p>
          </div>

          <div className="border border-[#fca5a5] rounded-[6px] p-4 bg-[#fef2f2]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#b91c1c] uppercase tracking-wider mb-1">
              <AlertOctagon className="w-4 h-4 text-[#dc2626]" />
              <span>3. NEEDS ATTENTION</span>
            </div>
            <p className="text-xs text-[#7f1d1d] leading-relaxed">
              Predefined clinical red flags raised strictly by a deterministic rule engine (RF-01 - RF-10).
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('/patient')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <User className="w-4 h-4" />
            <span>Open /patient View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onNavigate('/doctor')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[6px] bg-white border border-[#cbd5e1] hover:bg-[#f8faf9] text-[#0f172a] text-xs font-semibold shadow-xs transition-colors"
          >
            <Stethoscope className="w-4 h-4 text-[#0f766e]" />
            <span>Open /doctor View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleLaunchTamilDemo}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[6px] bg-[#f0fdfa] border border-[#99f6e4] hover:bg-[#ccfbf1] text-[#0f766e] text-xs font-semibold shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>1-Click Tamil Acceptance Demo</span>
          </button>
        </div>
      </div>

      {/* Acceptance Test Details */}
      <div className="bg-white border border-[#e2e8f0] rounded-[6px] p-6 shadow-xs">
        <h2 className="text-sm font-semibold text-[#0f172a] mb-2 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0f766e]" />
          <span>Phase 1 Acceptance Criteria & Verification</span>
        </h2>
        <div className="text-xs text-[#64748b] space-y-2 leading-relaxed">
          <p>
            <strong>Scenario:</strong> Patient complains in Tamil:
            <code className="mx-1 px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#0f172a] font-mono">
              "எனக்கு 4 நாளா கடுமையான இருமலும் மூச்சுத்திணறலும் இருக்கு. ரொம்ப கஷ்டமா இருக்கு."
            </code>
            (4-day severe cough and breathlessness, fever not mentioned).
          </p>
          <ul className="list-disc list-inside space-y-1 text-[#334155] pl-2">
            <li>
              <strong>Known items:</strong> Chief complaint (இருமல் மற்றும் மூச்சுத்திணறல்), Duration (4 days), Associated symptoms (மூச்சுத்திணறல்), with exact patient words quoted as evidence.
            </li>
            <li>
              <strong>Unknown items:</strong> Fever, Onset detail (sudden vs gradual), Severity scale (0-10 numeric), Medications.
            </li>
            <li>
              <strong>Needs attention item:</strong> Rule <code className="font-mono text-[#b91c1c] font-semibold">RF-02</code> (Severe or progressive breathlessness) raised deterministically by the rule engine with rule ID and review stamp.
            </li>
            <li>
              <strong>Follow-up question:</strong> One targeted question generated in Tamil for the highest-priority unknown field.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
