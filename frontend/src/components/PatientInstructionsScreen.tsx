import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  PhoneCall,
  UserCheck
} from 'lucide-react';
import { getPatientInstructions } from '../api';

interface PatientInstructionsScreenProps {
  sessionId: string;
  language: string;
}

export const PatientInstructionsScreen: React.FC<PatientInstructionsScreenProps> = ({
  sessionId,
  language
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchInstructions = async () => {
    try {
      const res = await getPatientInstructions(sessionId);
      setData(res);
    } catch (err) {
      console.warn('Could not fetch patient instructions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructions();
    const timer = setInterval(fetchInstructions, 3000);
    return () => clearInterval(timer);
  }, [sessionId, language]);

  if (loading && !data) {
    return (
      <div className="p-6 text-center text-xs text-[#64748b]">
        Loading doctor's instructions...
      </div>
    );
  }

  const isConfirmed = data?.doctor_confirmed;
  const instructions = data?.instructions;

  return (
    <div className="bg-white border border-[#cbd5e1] rounded-[6px] shadow-xs overflow-hidden mb-6">
      {/* Header */}
      <div className="bg-[#f8faf9] border-b border-[#cbd5e1] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0f766e]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">
            {language === 'ta'
              ? 'மருத்துவரின் அறிவுறுத்தல்கள் (Doctor\'s Instructions)'
              : language === 'hi'
              ? 'डॉक्टर के निर्देश (Doctor\'s Instructions)'
              : "Doctor's Instructions & Care Plan"}
          </h3>
        </div>
        {isConfirmed ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a]" />
            <span>Confirmed by doctor</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-[#fffbeb] text-[#b45309] border border-[#fef3c7]">
            <Clock className="w-3.5 h-3.5" />
            <span>Awaiting doctor confirmation</span>
          </span>
        )}
      </div>

      <div className="p-5">
        {/* Clinician Signature Card */}
        {isConfirmed && (
          <div className="mb-4 p-3 rounded-[6px] bg-[#f0fdf4] border border-[#99f6e4] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-[#166534]">
              <UserCheck className="w-4 h-4 text-[#0f766e]" />
              <div>
                <span className="font-semibold">{data.confirmed_by || 'Attending Clinician'}</span>
                <span className="text-[11px] text-[#15803d] ml-1.5">• Confirmed at {data.confirmed_at}</span>
              </div>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#bbf7d0] text-[#14532d] font-bold">
              Official Note
            </span>
          </div>
        )}

        {/* Instructions Body */}
        <div className="p-4 rounded-[6px] bg-[#f8faf9] border border-[#e2e8f0]">
          <div className="text-xs font-semibold text-[#0f172a] uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>
              {language === 'ta'
                ? 'உங்கள் மருத்துவ ஆலோசனைக் குறிப்பு:'
                : language === 'hi'
                ? 'आपके परामर्श निर्देश:'
                : 'Instructions for Patient:'}
            </span>
            <span className="text-[10px] font-normal text-[#64748b]">
              Restated in patient language
            </span>
          </div>
          <div className="text-xs text-[#0f172a] leading-relaxed whitespace-pre-line font-medium">
            {instructions}
          </div>
        </div>

        {/* AI Restatement Guarantee & Redirection Notice */}
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-[#64748b] bg-[#f8faf9] p-2.5 rounded-[4px] border border-[#e2e8f0]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0f766e] shrink-0" />
            <span>The AI only restates what the doctor wrote. It adds no new advice.</span>
          </div>

          <div className="flex items-center gap-1 text-[#b91c1c] font-medium">
            <PhoneCall className="w-3 h-3 text-[#dc2626]" />
            <span>Emergency: Dial 112 if worsening</span>
          </div>
        </div>
      </div>
    </div>
  );
};
