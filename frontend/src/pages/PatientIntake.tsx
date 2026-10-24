import React, { useState, useEffect } from 'react';
import {
  Send,
  SkipForward,
  MessageSquare,
  Globe,
  Sparkles,
  HelpCircle,
  Clock,
  Phone,
  FileCheck,
  ChevronRight,
  Video,
  Camera,
  BookOpen,
  PhoneCall,
  Stethoscope,
  Users,
  RefreshCw
} from 'lucide-react';
import type { SessionState } from '../types';
import {
  extractMissingInfo,
  skipField,
  loadTamilDemoScenario,
  requestConsultation,
  getConsultStatus
} from '../api';
import { SpeechMic } from '../components/SpeechMic';
import { EmergencyBanner } from '../components/EmergencyBanner';
import { ConsentNotice } from '../components/ConsentNotice';
import { PatientInstructionsScreen } from '../components/PatientInstructionsScreen';
import { VideoConsultation } from '../components/VideoConsultation';

interface PatientIntakeProps {
  sessionId: string;
  sessionState: SessionState | null;
  onRefreshSession: () => void;
  onOpenGuides?: () => void;
  onOpenSkinTriage?: () => void;
}

export const PatientIntake: React.FC<PatientIntakeProps> = ({
  sessionId,
  sessionState,
  onRefreshSession,
  onOpenGuides,
  onOpenSkinTriage
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedLang, setSelectedLang] = useState<'en' | 'ta' | 'hi'>('ta'); // Default Tamil for primary acceptance test
  const [consentAccepted, setConsentAccepted] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emergencyDetected, setEmergencyDetected] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'intake' | 'video' | 'instructions'>('intake');

  // Consultation Queue State
  const [consultStatus, setConsultStatus] = useState<'intake' | 'waiting' | 'matched' | 'in_call' | 'ended'>('intake');
  const [queuePosition, setQueuePosition] = useState<number>(0);
  const [assignedDoctor, setAssignedDoctor] = useState<{ id: string; name: string; peer_id: string } | null>(null);
  const [isRequestingConsult, setIsRequestingConsult] = useState(false);

  // Sync language with session when session updates
  useEffect(() => {
    if (sessionState?.language && ['en', 'ta', 'hi'].includes(sessionState.language)) {
      setSelectedLang(sessionState.language as any);
    }
    if (sessionState?.is_emergency) {
      setEmergencyDetected(true);
      setEmergencyReason(sessionState.emergency_alert?.alert_message || null);
    }
    if (sessionState?.status) {
      setConsultStatus(sessionState.status);
    }
  }, [sessionState]);

  // Queue status polling when waiting
  useEffect(() => {
    if (consultStatus !== 'waiting') return;
    const interval = setInterval(async () => {
      try {
        const status = await getConsultStatus(sessionId);
        setConsultStatus(status.status);
        setQueuePosition(status.queue_position);

        if (status.status === 'matched' && status.assigned_doctor_id) {
          setAssignedDoctor({
            id: status.assigned_doctor_id,
            name: status.assigned_doctor_name || 'Attending Clinician',
            peer_id: status.assigned_doctor_peer_id || `doctor-${status.assigned_doctor_id}`
          });
          setActiveTab('video');
          onRefreshSession();
        }
      } catch (e) {
        console.warn('Queue status poll error:', e);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [consultStatus, sessionId, onRefreshSession]);

  const handleRequestConsultation = async () => {
    setIsRequestingConsult(true);
    try {
      const res = await requestConsultation(
        sessionId,
        sessionState?.patient_id || undefined,
        sessionState?.patient_name || 'Patient',
        selectedLang
      );
      setConsultStatus(res.status);
      setQueuePosition(res.queue_position);

      if (res.status === 'matched' && res.assigned_doctor_id) {
        setAssignedDoctor({
          id: res.assigned_doctor_id,
          name: res.assigned_doctor_name || 'Attending Clinician',
          peer_id: res.assigned_doctor_peer_id || `doctor-${res.assigned_doctor_id}`
        });
        setActiveTab('video');
      }
      onRefreshSession();
    } catch (err) {
      console.error('Request consult failed:', err);
    } finally {
      setIsRequestingConsult(false);
    }
  };

  // Client-side instant emergency detector
  const checkInstantEmergency = (text: string): boolean => {
    const lower = text.toLowerCase();
    const emergencyWords = [
      'unconscious', 'not breathing', 'cannot breathe', 'collapsed',
      'cardiac arrest', 'heart attack', 'blue lips', 'severe anaphylaxis',
      'choking', 'massive bleeding', 'dying', 'suicide',
      'மயக்கம்', 'மூச்சு நின்ற', 'உயிர் போகுது',
      'बेहोश', 'सांस नहीं आ रही', 'खून बह रहा है'
    ];
    for (const w of emergencyWords) {
      if (lower.includes(w)) {
        return true;
      }
    }
    return false;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSubmitting) return;

    if (checkInstantEmergency(trimmed)) {
      setEmergencyDetected(true);
      setEmergencyReason('Emergency symptoms detected in statement. Please dial 112 immediately.');
    }

    setIsSubmitting(true);
    try {
      const history = (sessionState?.conversation_history || []).map((m) => ({
        role: m.role,
        text: m.text
      }));

      await extractMissingInfo(
        sessionId,
        trimmed,
        selectedLang,
        history,
        sessionState?.skipped_fields || []
      );
      setInputText('');
      onRefreshSession();
    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    const currentUnknownField = sessionState?.highest_priority_unknown?.field;
    if (!currentUnknownField || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await skipField(sessionId, currentUnknownField);
      onRefreshSession();
    } catch (err) {
      console.error('Skip failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadPredefinedComplaint = async (text: string, lang: 'en' | 'ta' | 'hi') => {
    setSelectedLang(lang);
    setInputText(text);
  };

  const handleLoadTamilDemo = async () => {
    setIsSubmitting(true);
    try {
      await loadTamilDemoScenario(sessionId);
      onRefreshSession();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const messages = sessionState?.conversation_history || [];
  const nextQuestion = sessionState?.highest_priority_unknown;
  const isDoctorConfirmed = sessionState?.doctor_note?.confirmed;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 w-full">
      {/* Top Banner & Language Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 bg-white p-4 rounded-[6px] border border-[#e2e8f0] shadow-xs">
        <div>
          <h1 className="text-lg font-semibold text-[#0f172a] tracking-tight">
            Patient Intake & Pre-Consultation
          </h1>
          <p className="text-xs text-[#64748b]">
            Please share your primary symptoms. ClearConsult assists your attending clinician in organizing key medical details.
          </p>
        </div>

        {/* Language selector */}
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#0f766e]" />
          <span className="text-xs text-[#475569] font-medium">Language:</span>
          <div className="inline-flex rounded-[4px] border border-[#e2e8f0] p-0.5 bg-[#f8faf9] text-xs">
            <button
              onClick={() => setSelectedLang('ta')}
              className={`px-2.5 py-1 rounded-[3px] font-medium transition-colors ${
                selectedLang === 'ta'
                  ? 'bg-[#0f766e] text-white shadow-xs'
                  : 'text-[#475569] hover:text-[#0f172a]'
              }`}
            >
              தமிழ் (Tamil)
            </button>
            <button
              onClick={() => setSelectedLang('hi')}
              className={`px-2.5 py-1 rounded-[3px] font-medium transition-colors ${
                selectedLang === 'hi'
                  ? 'bg-[#0f766e] text-white shadow-xs'
                  : 'text-[#475569] hover:text-[#0f172a]'
              }`}
            >
              हिन्दी (Hindi)
            </button>
            <button
              onClick={() => setSelectedLang('en')}
              className={`px-2.5 py-1 rounded-[3px] font-medium transition-colors ${
                selectedLang === 'en'
                  ? 'bg-[#0f766e] text-white shadow-xs'
                  : 'text-[#475569] hover:text-[#0f172a]'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Emergency Alert if triggered */}
      {(emergencyDetected || sessionState?.is_emergency) && (
        <EmergencyBanner message={emergencyReason || undefined} />
      )}

      {/* Doctor Confirmed Instructions Alert Banner */}
      {isDoctorConfirmed && (
        <div className="mb-4 bg-[#f0fdf4] border border-[#86efac] rounded-[6px] p-3 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#166534]">
            <FileCheck className="w-4 h-4 text-[#16a34a]" />
            <span>
              <strong>Doctor's Consultation Note Confirmed.</strong> Your instructions are ready in{' '}
              {selectedLang === 'ta' ? 'Tamil (தமிழ்)' : selectedLang === 'hi' ? 'Hindi (हिन्दी)' : 'English'}.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('instructions')}
            className="flex items-center gap-1 font-semibold text-[#0f766e] hover:underline"
          >
            <span>View Instructions</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs between Chat and Instructions */}
      <div className="flex items-center gap-2 border-b border-[#cbd5e1] mb-4">
        <button
          onClick={() => setActiveTab('intake')}
          className={`pb-2 px-3 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'intake'
              ? 'border-[#0f766e] text-[#0f766e]'
              : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Intake Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('video')}
          className={`pb-2 px-3 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'video'
              ? 'border-[#0f766e] text-[#0f766e]'
              : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Live Video Call</span>
        </button>

        <button
          onClick={() => setActiveTab('instructions')}
          className={`pb-2 px-3 text-xs font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'instructions'
              ? 'border-[#0f766e] text-[#0f766e]'
              : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Doctor's Instructions</span>
          {isDoctorConfirmed && (
            <span className="w-2 h-2 rounded-full bg-[#16a34a]"></span>
          )}
        </button>
      </div>

      {/* SCREEN: POST-CALL INSTRUCTIONS */}
      {activeTab === 'instructions' ? (
        <PatientInstructionsScreen sessionId={sessionId} language={selectedLang} />
      ) : activeTab === 'video' ? (
        <div className="mb-6 space-y-4">
          {assignedDoctor && (
            <div className="p-3 bg-[#f0fdf4] border border-[#86efac] rounded-[6px] text-xs flex items-center justify-between text-[#166534]">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-[#16a34a]" />
                <span>Connected with <strong>{assignedDoctor.name}</strong></span>
              </div>
              <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#bbf7d0]">
                Peer ID: {assignedDoctor.peer_id}
              </span>
            </div>
          )}
          <VideoConsultation
            role="patient"
            sessionId={sessionId}
            targetDoctorPeerId={assignedDoctor?.peer_id || undefined}
            onCallEnded={() => {
              setConsultStatus('ended');
              onRefreshSession();
            }}
          />
        </div>
      ) : (
        <>
          {/* Waiting Room Queue Card if currently queued */}
          {consultStatus === 'waiting' && (
            <div className="mb-4 bg-gradient-to-r from-[#f0fdfa] to-[#e6fffa] border border-[#99f6e4] rounded-[6px] p-5 shadow-xs text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#0f766e]/10 text-[#0f766e] mb-3">
                <Users className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#0f766e] mb-1">
                You are in the Clinician Waiting Queue
              </div>
              <h3 className="text-2xl font-bold text-[#0f172a] mb-1">
                Queue Position #{queuePosition > 0 ? queuePosition : 1}
              </h3>
              <p className="text-xs text-[#475569] max-w-md mx-auto">
                An attending doctor is reviewing your intake data and will connect with you momentarily. Please keep this screen open.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#0f766e]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Checking clinician availability every 2 seconds...</span>
              </div>
            </div>
          )}

          {/* Consent Notice */}
          <ConsentNotice
            accepted={consentAccepted}
            onAccept={() => setConsentAccepted(true)}
          />

          {/* Quick Test Presets */}
          <div className="mb-4 bg-[#f8faf9] border border-[#e2e8f0] rounded-[6px] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748b] mb-2 flex items-center justify-between">
              <span>Quick Hackathon Test Scenarios (Click to test):</span>
              <span className="text-[#0f766e] font-normal">Phase 1 & 2 Acceptance</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() =>
                  loadPredefinedComplaint(
                    'எனக்கு 4 நாளா கடுமையான இருமலும் மூச்சுத்திணறலும் இருக்கு. ரொம்ப கஷ்டமா இருக்கு.',
                    'ta'
                  )
                }
                className="text-xs text-left px-2.5 py-1.5 rounded-[4px] bg-white border border-[#99f6e4] text-[#0f766e] hover:bg-[#f0fdfa] transition-colors"
              >
                <span className="font-semibold">[Tamil Acceptance]</span> 4 நாளா கடுமையான இருமல் & மூச்சுத்திணறல்
              </button>
              <button
                onClick={handleLoadTamilDemo}
                className="text-xs px-2.5 py-1.5 rounded-[4px] bg-[#0f766e] text-white hover:bg-[#115e59] transition-colors shadow-xs flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>1-Click Load Full Tamil State</span>
              </button>
              <button
                onClick={() =>
                  loadPredefinedComplaint(
                    'I have severe central chest pain and difficulty breathing since morning, rated 8 out of 10.',
                    'en'
                  )
                }
                className="text-xs px-2.5 py-1.5 rounded-[4px] bg-white border border-[#e2e8f0] text-[#334155] hover:bg-white/80 transition-colors"
              >
                [English] Chest Pain & Breathlessness (RF-01)
              </button>
              <button
                onClick={() =>
                  loadPredefinedComplaint(
                    'मुझे आज सुबह से अचानक बहुत भयानक सिरदर्द है (9/10) और उल्टी हो रही है।',
                    'hi'
                  )
                }
                className="text-xs px-2.5 py-1.5 rounded-[4px] bg-white border border-[#e2e8f0] text-[#334155] hover:bg-white/80 transition-colors"
              >
                [Hindi] Thunderclap Headache (RF-03)
              </button>

              {onOpenSkinTriage && (
                <button
                  type="button"
                  onClick={onOpenSkinTriage}
                  className="text-xs px-2.5 py-1.5 rounded-[4px] bg-white border border-[#99f6e4] text-[#0f766e] hover:bg-[#f0fdfa] transition-colors flex items-center gap-1.5 font-medium ml-auto"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Upload Skin Photo</span>
                </button>
              )}
              {onOpenGuides && (
                <button
                  type="button"
                  onClick={onOpenGuides}
                  className="text-xs px-2.5 py-1.5 rounded-[4px] bg-white border border-[#e2e8f0] text-[#475569] hover:bg-slate-50 transition-colors flex items-center gap-1.5 font-medium"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Device Guides</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Intake Conversation Panel */}
          <div className="bg-white border border-[#e2e8f0] rounded-[6px] shadow-xs overflow-hidden flex flex-col min-h-[440px]">
            {/* Header */}
            <div className="bg-[#f8faf9] border-b border-[#e2e8f0] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#0f766e]" />
                <h2 className="text-xs font-semibold text-[#0f172a] uppercase tracking-wide">
                  Clinical Conversation Transcript
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#64748b]">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Session: <code className="font-mono text-[#0f172a]">{sessionId}</code></span>
                </span>
                <span className="inline-block w-2 h-2 rounded-full bg-[#10b981]"></span>
              </div>
            </div>

            {/* Message history */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#fafcfb]">
              {messages.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center text-center p-6 text-[#94a3b8]">
                  <HelpCircle className="w-8 h-8 text-[#cbd5e1] mb-2" />
                  <p className="text-sm font-medium text-[#475569]">No statements recorded yet</p>
                  <p className="text-xs text-[#94a3b8] max-w-sm mt-1">
                    Type or speak your symptoms below in Tamil, Hindi, or English to begin the clinical intake.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.role === 'patient' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="text-[10px] text-[#64748b] mb-1 px-1">
                      {msg.role === 'patient' ? 'You (Patient)' : 'ClearConsult Follow-Up'}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-[6px] px-3.5 py-2.5 text-xs leading-relaxed ${
                        msg.role === 'patient'
                          ? 'bg-[#0f766e] text-white shadow-xs font-normal'
                          : 'bg-white border border-[#e2e8f0] text-[#0f172a] shadow-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}

              {/* Active ONE Follow-Up Question Card */}
              {nextQuestion && (
                <div className="mt-4 border border-[#99f6e4] bg-[#f0fdfa] rounded-[6px] p-3.5 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#ccfbf1] text-[#0f766e]">
                          Single Follow-up Question
                        </span>
                        <span className="text-[11px] text-[#64748b]">
                          Target Unknown Field: <strong className="font-mono text-[#0f766e]">{nextQuestion.field}</strong>
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[#115e59] mt-1 leading-snug">
                        {nextQuestion.question}
                      </p>
                      {nextQuestion.question_en && selectedLang !== 'en' && (
                        <p className="text-[11px] text-[#0f766e]/80 mt-0.5 italic">
                          En: {nextQuestion.question_en}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleSkip}
                      disabled={isSubmitting}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-[4px] border border-[#cbd5e1] bg-white hover:bg-[#f8faf9] text-[#64748b] hover:text-[#0f172a] text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
                      title="Skip this question if unknown or not applicable"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Skip</span>
                    </button>
                  </div>
                </div>
              )}

              {sessionState?.all_key_fields_known && (
                <div className="mt-4 border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] rounded-[6px] p-3 text-xs flex items-center justify-between">
                  <span>All key intake information has been categorized for your physician.</span>
                  <span className="font-semibold text-[11px]">Intake Complete</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="border-t border-[#e2e8f0] bg-white p-3">
              <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      selectedLang === 'ta'
                        ? 'உங்கள் உடல் பிரச்சனையை இங்கே தட்டச்சு செய்யவும் அல்லது பேசவும்...'
                        : selectedLang === 'hi'
                        ? 'अपनी समस्या यहाँ लिखें या बोलकर बताएं...'
                        : 'Describe your symptoms or answer the question above...'
                    }
                    className="flex-1 px-3.5 py-2.5 rounded-[6px] border border-[#cbd5e1] text-xs text-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#0f766e] focus:border-[#0f766e] bg-[#f8faf9]"
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSubmitting}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-[6px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-medium transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Processing...' : 'Send'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <SpeechMic
                    language={selectedLang}
                    onTranscript={(transcript) => {
                      setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
                    }}
                    disabled={isSubmitting}
                  />

                  <div className="flex items-center gap-3 text-[11px] text-[#64748b]">
                    <button
                      type="button"
                      onClick={() => {
                        setEmergencyDetected(true);
                        setEmergencyReason('Emergency assistance requested by patient button.');
                      }}
                      className="flex items-center gap-1 text-[#dc2626] hover:underline font-medium"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call 112 (Emergency)</span>
                    </button>
                    <span>Press Enter to send</span>
                  </div>
                </div>
              </form>
            </div>

            {/* Consultation Request Action Bar */}
            <div className="bg-[#f0fdfa] border-t border-[#ccfbf1] p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#0f766e]/10 text-[#0f766e] flex items-center justify-center shrink-0 border border-[#0f766e]/20">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0f172a]">
                    {consultStatus === 'waiting'
                      ? 'Waiting for an available clinician...'
                      : consultStatus === 'matched'
                      ? 'Clinician Matched & Waiting!'
                      : 'Done with symptom intake?'}
                  </div>
                  <div className="text-[11px] text-[#64748b]">
                    {consultStatus === 'waiting'
                      ? `Position #${queuePosition} in queue. You will be connected automatically.`
                      : consultStatus === 'matched'
                      ? `Dr. ${assignedDoctor?.name || 'Clinician'} is ready to consult with you.`
                      : 'Connect directly with an attending doctor via encrypted peer-to-peer video.'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                {consultStatus === 'waiting' ? (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto px-4 py-2 rounded-[4px] bg-[#94a3b8] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>In Queue (#{queuePosition})</span>
                  </button>
                ) : consultStatus === 'matched' ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab('video')}
                    className="w-full sm:w-auto px-4 py-2 rounded-[4px] bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Join Consultation Video</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestConsultation}
                    disabled={isRequestingConsult}
                    className="w-full sm:w-auto px-4 py-2 rounded-[4px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{isRequestingConsult ? 'Requesting...' : 'Request Consultation'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
