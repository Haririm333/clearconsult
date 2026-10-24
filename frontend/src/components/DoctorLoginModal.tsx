import React, { useState } from 'react';
import { Stethoscope, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface DoctorLoginModalProps {
  onLogin: (doctorId: string, doctorName: string, specialty: string) => void;
}

export const DoctorLoginModal: React.FC<DoctorLoginModalProps> = ({ onLogin }) => {
  const [doctorId, setDoctorId] = useState('aravind');
  const [doctorName, setDoctorName] = useState('Dr. Aravind Swaminathan, MD');
  const [specialty, setSpecialty] = useState('General Medicine');

  const presets = [
    {
      id: 'aravind',
      name: 'Dr. Aravind Swaminathan, MD',
      specialty: 'General Medicine'
    },
    {
      id: 'priya',
      name: 'Dr. Priya Sharma, MD',
      specialty: 'Pulmonology'
    },
    {
      id: 'rajesh',
      name: 'Dr. Rajesh Kumar, MS',
      specialty: 'Emergency Medicine'
    }
  ];

  const handleSelectPreset = (p: typeof presets[0]) => {
    setDoctorId(p.id);
    setDoctorName(p.name);
    setSpecialty(p.specialty);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId.trim() || !doctorName.trim()) return;
    onLogin(doctorId.trim().toLowerCase(), doctorName.trim(), specialty.trim());
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-white border border-[#cbd5e1] rounded-[8px] shadow-md max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#0f766e]/10 text-[#0f766e] flex items-center justify-center mx-auto mb-3 border border-[#0f766e]/30">
            <Stethoscope className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-[#0f172a]">Clinician Station Sign-In</h1>
          <p className="text-xs text-[#64748b] mt-1">
            Choose a clinician profile or enter your details to connect to the ClearConsult consultation queue.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="mb-5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#475569] block mb-2">
            Quick Preset Profiles:
          </label>
          <div className="space-y-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`w-full text-left p-2.5 rounded-[4px] border text-xs flex items-center justify-between transition-colors ${
                  doctorId === p.id
                    ? 'border-[#0f766e] bg-[#f0fdfa] text-[#0f766e] font-semibold'
                    : 'border-[#e2e8f0] bg-white text-[#334155] hover:bg-[#f8faf9]'
                }`}
              >
                <div>
                  <div className="font-bold">{p.name}</div>
                  <div className="text-[11px] text-[#64748b]">{p.specialty} • Peer ID: doctor-{p.id}</div>
                </div>
                {doctorId === p.id && <Sparkles className="w-4 h-4 text-[#0f766e]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 border-t border-[#e2e8f0] pt-4">
          <div>
            <label className="text-[11px] font-semibold text-[#475569] block mb-1">
              Clinician Full Name & Title
            </label>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              required
              className="w-full text-xs px-3 py-2 rounded-[4px] border border-[#cbd5e1] focus:outline-none focus:border-[#0f766e]"
              placeholder="e.g. Dr. Maya Patel, MD"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#475569] block mb-1">
              Doctor ID (Used for PeerJS: doctor-&lt;id&gt;)
            </label>
            <input
              type="text"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              required
              className="w-full text-xs px-3 py-2 font-mono rounded-[4px] border border-[#cbd5e1] focus:outline-none focus:border-[#0f766e]"
              placeholder="e.g. maya"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-[4px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Enter Doctor Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-[#e2e8f0] flex items-center justify-center gap-1.5 text-[10px] text-[#64748b]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0f766e]" />
          <span>Local demo authentication • PeerJS P2P encrypted</span>
        </div>
      </div>
    </div>
  );
};
