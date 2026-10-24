import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-[#e2e8f0] bg-white py-4 px-6 text-xs text-[#64748b]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-medium text-[#334155]">
          <ShieldCheck className="w-4 h-4 text-[#0f766e]" />
          <span>ClearConsult supports the doctor. It does not diagnose or replace medical advice.</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-[#64748b]">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-[#0f766e]" />
            Rule Engine (RF-01 - RF-10) Active
          </span>
          <span>In-Memory Session Only</span>
          <span>Zero Persistent DB</span>
        </div>
      </div>
    </footer>
  );
};
