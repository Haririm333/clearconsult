import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Download,
  Edit3,
  ShieldCheck,
  Save,
  Check
} from 'lucide-react';
import { getDoctorNote, updateDoctorNote, confirmDoctorNote, getExportPdfUrl } from '../api';

interface DoctorNotePanelProps {
  sessionId: string;
  doctorName?: string;
  onNoteConfirmed?: () => void;
  onNoteUpdated?: () => void;
}

export const DoctorNotePanel: React.FC<DoctorNotePanelProps> = ({
  sessionId,
  doctorName = 'Attending Clinician (Dr. Verified)',
  onNoteConfirmed,
  onNoteUpdated
}) => {
  const [note, setNote] = useState<any>({
    complaint: '',
    timeline: '',
    severity: '',
    associated_symptoms: '',
    gaps_open: '',
    doctor_instructions: '',
    confirmed: false,
    confirmed_at: null,
    confirmed_by: 'Attending Clinician'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const fetchNote = async () => {
    try {
      const data = await getDoctorNote(sessionId);
      setNote(data);
    } catch (err) {
      console.warn('Could not fetch doctor note:', err);
    }
  };

  useEffect(() => {
    fetchNote();
  }, [sessionId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoctorNote(sessionId, note);
      setIsEditing(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      if (onNoteUpdated) onNoteUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const res = await confirmDoctorNote(
        sessionId,
        doctorName,
        note.doctor_instructions
      );
      setNote(res.doctor_note);
      setIsEditing(false);
      if (onNoteConfirmed) onNoteConfirmed();
      if (onNoteUpdated) onNoteUpdated();
    } catch (err) {
      console.error(err);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleExportPdf = () => {
    const url = getExportPdfUrl(sessionId);
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white border border-[#cbd5e1] rounded-[6px] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="bg-[#f8faf9] border-b border-[#cbd5e1] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#0f766e]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">
            Structured Consultation Note
          </h2>
          {note.confirmed && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
              <Check className="w-3 h-3 text-[#16a34a]" />
              <span>Confirmed by doctor</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!note.confirmed && (
            <button
              onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
              disabled={isSaving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] border border-[#cbd5e1] bg-white hover:bg-[#f8faf9] text-xs font-medium text-[#334155] transition-colors"
            >
              {isEditing ? (
                <>
                  <Save className="w-3 h-3 text-[#0f766e]" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3 h-3 text-[#64748b]" />
                  <span>Edit Note</span>
                </>
              )}
            </button>
          )}

          {/* Export PDF Button */}
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-white border border-[#0f766e] text-[#0f766e] hover:bg-[#f0fdfa] text-xs font-semibold transition-colors shadow-2xs"
            title="Download PDF clinical note"
          >
            <Download className="w-3 h-3" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Confirmation Stamp Banner */}
      {note.confirmed ? (
        <div className="bg-[#f0fdf4] border-b border-[#bbf7d0] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#dcfce7] flex items-center justify-center text-[#16a34a] border border-[#86efac]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#166534] tracking-tight uppercase">
                Confirmed by Doctor
              </div>
              <div className="text-[11px] text-[#15803d]">
                Signed by <span className="font-semibold">{note.confirmed_by || 'Attending Clinician'}</span> • Stamp applied on {note.confirmed_at}
              </div>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#bbf7d0] text-[#14532d] font-bold">
            Locked & Stamped
          </span>
        </div>
      ) : (
        <div className="bg-[#fffbeb] border-b border-[#fef3c7] px-4 py-2 text-[11px] text-[#92400e] flex items-center justify-between">
          <span>Draft note generated from intake facts. Review, edit as necessary, and confirm.</span>
          {justSaved && <span className="font-semibold text-[#16a34a]">Changes saved</span>}
        </div>
      )}

      {/* Structured Fields */}
      <div className="p-4 space-y-3.5 text-xs">
        {/* 1. Complaint */}
        <div>
          <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1">
            1. Chief Complaint & Patient Evidence
          </label>
          {isEditing ? (
            <textarea
              rows={2}
              value={note.complaint || ''}
              onChange={(e) => setNote({ ...note, complaint: e.target.value })}
              className="w-full p-2 border border-[#cbd5e1] rounded-[4px] text-xs text-[#0f172a] focus:ring-1 focus:ring-[#0f766e]"
            />
          ) : (
            <div className="p-2.5 rounded-[4px] bg-[#f8faf9] border border-[#e2e8f0] text-[#0f172a] leading-relaxed">
              {note.complaint || 'Chief complaint not specified.'}
            </div>
          )}
        </div>

        {/* 2. Timeline & Severity Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1">
              2. Timeline & Duration
            </label>
            {isEditing ? (
              <input
                type="text"
                value={note.timeline || ''}
                onChange={(e) => setNote({ ...note, timeline: e.target.value })}
                className="w-full p-2 border border-[#cbd5e1] rounded-[4px] text-xs text-[#0f172a]"
              />
            ) : (
              <div className="p-2.5 rounded-[4px] bg-[#f8faf9] border border-[#e2e8f0] text-[#0f172a]">
                {note.timeline || 'Timeline unknown.'}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1">
              3. Reported Severity
            </label>
            {isEditing ? (
              <input
                type="text"
                value={note.severity || ''}
                onChange={(e) => setNote({ ...note, severity: e.target.value })}
                className="w-full p-2 border border-[#cbd5e1] rounded-[4px] text-xs text-[#0f172a]"
              />
            ) : (
              <div className="p-2.5 rounded-[4px] bg-[#f8faf9] border border-[#e2e8f0] text-[#0f172a]">
                {note.severity || 'Severity unrated.'}
              </div>
            )}
          </div>
        </div>

        {/* 4. Associated Symptoms */}
        <div>
          <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1">
            4. Associated Symptoms
          </label>
          {isEditing ? (
            <input
              type="text"
              value={note.associated_symptoms || ''}
              onChange={(e) => setNote({ ...note, associated_symptoms: e.target.value })}
              className="w-full p-2 border border-[#cbd5e1] rounded-[4px] text-xs text-[#0f172a]"
            />
          ) : (
            <div className="p-2.5 rounded-[4px] bg-[#f8faf9] border border-[#e2e8f0] text-[#0f172a]">
              {note.associated_symptoms || 'None reported.'}
            </div>
          )}
        </div>

        {/* 5. Gaps Still Open */}
        <div>
          <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-1">
            5. Gaps Still Open / Unresolved
          </label>
          {isEditing ? (
            <textarea
              rows={2}
              value={note.gaps_open || ''}
              onChange={(e) => setNote({ ...note, gaps_open: e.target.value })}
              className="w-full p-2 border border-[#cbd5e1] rounded-[4px] text-xs text-[#0f172a]"
            />
          ) : (
            <div className="p-2.5 rounded-[4px] bg-[#f8faf9] border border-[#e2e8f0] text-[#64748b] italic">
              {note.gaps_open || 'No open gaps identified.'}
            </div>
          )}
        </div>

        {/* 6. Doctor's Instructions / Plan for Patient */}
        <div>
          <label className="block text-[11px] font-bold text-[#0f766e] uppercase tracking-wider mb-1">
            6. Doctor's Plain-Language Instructions for Patient
          </label>
          {isEditing || !note.confirmed ? (
            <textarea
              rows={3}
              value={note.doctor_instructions || ''}
              onChange={(e) => setNote({ ...note, doctor_instructions: e.target.value })}
              placeholder="Write concise plain-language advice for the patient. The AI will restate this verbatim in their language."
              className="w-full p-2.5 border border-[#cbd5e1] rounded-[4px] text-xs text-[#0f172a] focus:ring-1 focus:ring-[#0f766e] bg-white leading-relaxed"
            />
          ) : (
            <div className="p-3 rounded-[4px] bg-[#f0fdfa] border border-[#99f6e4] text-[#0f766e] font-medium leading-relaxed">
              {note.doctor_instructions}
            </div>
          )}
        </div>

        {/* Confirmation Button */}
        {!note.confirmed && (
          <div className="pt-2 flex items-center justify-between border-t border-[#e2e8f0]">
            <span className="text-[11px] text-[#64748b]">
              Confirming locks the clinical note and restates instructions for the patient.
            </span>
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[4px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isConfirming ? 'Applying Stamp...' : 'Confirm & Sign Note'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
