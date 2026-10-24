import React, { useState } from 'react';
import {
  BookOpen,
  Thermometer,
  Activity,
  Wind,
  Heart,
  X,
  ChevronRight
} from 'lucide-react';
import { HOW_TO_GUIDES } from '../data/guides';

interface HowToGuidesModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultLang?: 'en' | 'ta' | 'hi';
}

export const HowToGuidesModal: React.FC<HowToGuidesModalProps> = ({
  isOpen,
  onClose,
  defaultLang = 'en'
}) => {
  const [selectedGuideId, setSelectedGuideId] = useState<string>('thermometer');
  const [lang, setLang] = useState<'en' | 'ta' | 'hi'>(defaultLang);

  if (!isOpen) return null;

  const currentGuide = HOW_TO_GUIDES.find((g) => g.id === selectedGuideId) || HOW_TO_GUIDES[0];

  const getGuideIcon = (name: string) => {
    switch (name) {
      case 'thermometer':
        return <Thermometer className="w-4 h-4 text-[#0f766e]" />;
      case 'activity':
        return <Activity className="w-4 h-4 text-[#0f766e]" />;
      case 'wind':
        return <Wind className="w-4 h-4 text-[#0f766e]" />;
      case 'heart':
      default:
        return <Heart className="w-4 h-4 text-[#0f766e]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[6px] border border-[#cbd5e1] max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#f8faf9] border-b border-[#cbd5e1] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#0f766e]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0f172a]">
              Clinical Device How-To Guides
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-[4px] border border-[#e2e8f0] text-xs">
              <button
                onClick={() => setLang('ta')}
                className={`px-2 py-0.5 rounded-[3px] font-medium transition-colors ${
                  lang === 'ta' ? 'bg-[#0f766e] text-white' : 'text-[#64748b]'
                }`}
              >
                தமிழ்
              </button>
              <button
                onClick={() => setLang('hi')}
                className={`px-2 py-0.5 rounded-[3px] font-medium transition-colors ${
                  lang === 'hi' ? 'bg-[#0f766e] text-white' : 'text-[#64748b]'
                }`}
              >
                हिन्दी
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 rounded-[3px] font-medium transition-colors ${
                  lang === 'en' ? 'bg-[#0f766e] text-white' : 'text-[#64748b]'
                }`}
              >
                English
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[#e2e8f0] text-[#64748b]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
          {/* Guide Selector List */}
          <div className="w-full md:w-56 border-r border-[#e2e8f0] bg-[#fafcfb] p-3 space-y-1">
            {HOW_TO_GUIDES.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGuideId(g.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-[4px] text-xs font-medium text-left transition-colors ${
                  selectedGuideId === g.id
                    ? 'bg-[#0f766e] text-white shadow-xs'
                    : 'text-[#334155] hover:bg-[#f1f5f9]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={selectedGuideId === g.id ? 'text-white' : 'text-[#0f766e]'}>
                    {getGuideIcon(g.iconName)}
                  </span>
                  <span className="truncate">{g.name[lang] || g.name.en}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
          </div>

          {/* Guide Steps View */}
          <div className="flex-1 p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#e2e8f0] pb-2">
              <span className="p-1.5 rounded bg-[#f0fdfa] border border-[#99f6e4]">
                {getGuideIcon(currentGuide.iconName)}
              </span>
              <h4 className="text-sm font-bold text-[#0f172a]">
                {currentGuide.name[lang] || currentGuide.name.en}
              </h4>
            </div>

            <div className="space-y-3">
              {(currentGuide.steps[lang] || currentGuide.steps.en).map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-[4px] bg-[#f8faf9] border border-[#e2e8f0] text-xs leading-relaxed text-[#0f172a]"
                >
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#f8faf9] border-t border-[#cbd5e1] px-5 py-2.5 text-[11px] text-[#64748b] flex items-center justify-between">
          <span>Instructional guide only. For medical emergency, dial 112.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-[4px] bg-[#0f766e] text-white text-xs font-medium"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
