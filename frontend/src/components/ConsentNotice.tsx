import React from 'react';
import { Shield, Check } from 'lucide-react';

interface ConsentNoticeProps {
  accepted: boolean;
  onAccept: () => void;
}

export const ConsentNotice: React.FC<ConsentNoticeProps> = ({ accepted, onAccept }) => {
  if (accepted) {
    return (
      <div className="flex items-center justify-between bg-[#f0fdfa] border border-[#99f6e4] text-[#0f766e] text-xs px-3 py-2 rounded-[6px] mb-4">
        <div className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-[#0f766e]" />
          <span>Patient intake advisory and privacy notice acknowledged</span>
        </div>
        <span className="text-[10px] text-[#0f766e] font-mono">No video/audio stored</span>
      </div>
    );
  }

  return (
    <div className="border border-[#e2e8f0] bg-white rounded-[6px] p-4 mb-4 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="p-1 rounded-[4px] bg-[#f0fdfa] text-[#0f766e] shrink-0 mt-0.5">
          <Shield className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-xs text-[#0f172a]">
            Clinical Pre-Consultation Intake Consent
          </h4>
          <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
            ClearConsult is an assistive clinical transcription tool. It organizes your reported symptoms into Known and Unknown categories for your attending physician. It does not offer a medical diagnosis, predict illness, or prescribe medications. All consultation data remains in-memory only.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-[#64748b]">
              For life-threatening emergencies, call 112 immediately.
            </span>
            <button
              onClick={onAccept}
              className="px-3 py-1.5 rounded-[4px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-medium transition-colors shadow-xs"
            >
              I Understand & Agree
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
