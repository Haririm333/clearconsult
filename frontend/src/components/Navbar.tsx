import React from 'react';
import { Activity, Stethoscope, User, Play, RefreshCw, BookOpen, Camera } from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  sessionId: string;
  onSessionChange: (id: string) => void;
  onLoadTamilDemo: () => void;
  onReset: () => void;
  onOpenGuides?: () => void;
  onOpenSkinTriage?: () => void;
  isLoading?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  sessionId,
  onSessionChange,
  onLoadTamilDemo,
  onReset,
  onOpenGuides,
  onOpenSkinTriage,
  isLoading
}) => {
  return (
    <header className="border-b border-[#e2e8f0] bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2.5 text-[#0f172a] hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-[6px] bg-[#0f766e] flex items-center justify-center text-white shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-base leading-tight tracking-tight flex items-center gap-2">
                <span>ClearConsult</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]">
                  Clinical Triage
                </span>
              </div>
              <div className="text-[11px] text-[#64748b] leading-none hidden sm:block">
                Missing Information & Uncertainty Detector
              </div>
            </div>
          </a>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-[6px] text-xs font-medium">
          <a
            href="/patient"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] transition-colors ${
              currentPath === '/patient'
                ? 'bg-white text-[#0f766e] shadow-xs font-semibold'
                : 'text-[#475569] hover:text-[#0f172a]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Patient Intake</span>
          </a>
          <a
            href="/doctor"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] transition-colors ${
              currentPath === '/doctor'
                ? 'bg-white text-[#0f766e] shadow-xs font-semibold'
                : 'text-[#475569] hover:text-[#0f172a]'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Doctor View</span>
          </a>
        </nav>

        {/* Clinical Tools & Session Controls */}
        <div className="flex items-center gap-2">
          {/* How-To Guides Button */}
          {onOpenGuides && (
            <button
              onClick={onOpenGuides}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-[#cbd5e1] hover:bg-[#f8faf9] text-[#334155] text-xs font-medium transition-colors"
              title="How-to guides (Thermometer, BP, Inhaler, Oximeter)"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#0f766e]" />
              <span>Guides</span>
            </button>
          )}

          {/* Skin Photo Triage Button */}
          {onOpenSkinTriage && (
            <button
              onClick={onOpenSkinTriage}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-[#cbd5e1] hover:bg-[#f8faf9] text-[#334155] text-xs font-medium transition-colors"
              title="Skin photo objective triage (no diagnosis)"
            >
              <Camera className="w-3.5 h-3.5 text-[#0f766e]" />
              <span>Skin Photo</span>
            </button>
          )}

          {/* Quick Demo Button */}
          <button
            onClick={onLoadTamilDemo}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
            title="Load Tamil 4-day cough & breathlessness scenario"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span className="hidden md:inline">Tamil Demo</span>
          </button>

          {/* Reset Button */}
          <button
            onClick={onReset}
            disabled={isLoading}
            className="flex items-center gap-1 p-1.5 rounded-[6px] border border-[#e2e8f0] hover:bg-[#f8faf9] text-[#64748b] hover:text-[#0f172a] text-xs transition-colors"
            title="Reset session state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Session ID input */}
          <div className="hidden lg:flex items-center gap-1 text-xs border border-[#e2e8f0] px-2 py-1 rounded-[6px] bg-[#f8faf9]">
            <span className="text-[#94a3b8] font-mono text-[11px]">ID:</span>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => onSessionChange(e.target.value)}
              className="w-24 bg-transparent text-[#334155] font-mono text-[11px] focus:outline-none"
              title="Shared session ID between patient and doctor"
            />
          </div>
        </div>
      </div>
    </header>
  );
};
