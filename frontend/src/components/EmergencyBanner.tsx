import React from 'react';
import { AlertOctagon, PhoneCall } from 'lucide-react';

interface EmergencyBannerProps {
  message?: string;
  onDismiss?: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({ message }) => {
  return (
    <div
      role="alert"
      className="border border-[#fca5a5] bg-[#fef2f2] text-[#991b1b] rounded-[6px] p-4 shadow-sm mb-4"
    >
      <div className="flex items-start gap-3">
        <div className="p-1 rounded-[4px] bg-[#fee2e2] text-[#dc2626] shrink-0 mt-0.5">
          <AlertOctagon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm tracking-tight text-[#991b1b]">
              IMMEDIATE EMERGENCY ADVISORY (DIAL 112)
            </h4>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#fecaca] text-[#7f1d1d] font-bold">
              RULE: SAFETY-EMERGENCY-112
            </span>
          </div>
          <p className="text-xs text-[#7f1d1d] mt-1 leading-relaxed">
            {message ||
              'ClearConsult is a clinical intake support tool and does not manage active life-threatening emergencies. If you are experiencing severe breathing failure, chest tightness, unconsciousness, or massive bleeding, please call 112 or your local emergency medical service immediately.'}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <a
              href="tel:112"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Emergency (112)</span>
            </a>
            <span className="text-[11px] text-[#991b1b] font-medium">
              No AI model involved in emergency alert
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
