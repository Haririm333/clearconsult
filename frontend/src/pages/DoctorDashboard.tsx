import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  HelpCircle,
  AlertOctagon,
  Quote,
  ShieldAlert,
  RefreshCw,
  Sparkles,
  FileText,
  Camera,
  BookOpen,
  Users,
  LogOut,
  Stethoscope,
  Activity,
  History,
  PhoneCall
} from 'lucide-react';
import type { SessionState, ExtractedField, ItemSource, WaitingPatientItem, DoctorRecord } from '../types';
import {
  loadTamilDemoScenario,
  resetSession,
  registerDoctor,
  sendDoctorHeartbeat,
  listDoctors,
  getDoctorRecentSessions,
  getWaitingQueue,
  acceptPatient,
  seedMultiRoomDemo
} from '../api';
import { DoctorNotePanel } from '../components/DoctorNotePanel';
import { VideoConsultation } from '../components/VideoConsultation';
import { VitalsEstimator } from '../components/VitalsEstimator';
import { DoctorLoginModal } from '../components/DoctorLoginModal';
import { DoctorWaitingList } from '../components/DoctorWaitingList';

interface DoctorDashboardProps {
  sessionId: string;
  sessionState: SessionState | null;
  onRefresh: () => void;
  onSelectSession?: (sessionId: string) => void;
  isLoading?: boolean;
  onOpenGuides?: () => void;
  onOpenSkinTriage?: () => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({
  sessionId,
  sessionState,
  onRefresh,
  onSelectSession,
  isLoading,
  onOpenGuides,
  onOpenSkinTriage
}) => {
  // Doctor authentication state (stored in localStorage)
  const [currentDoctor, setCurrentDoctor] = useState<{ id: string; name: string; specialty: string } | null>(() => {
    try {
      const saved = localStorage.getItem('clearconsult_doctor');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const [doctorStatus, setDoctorStatus] = useState<'available' | 'busy' | 'offline'>('available');
  const [waitingQueue, setWaitingQueue] = useState<WaitingPatientItem[]>([]);
  const [otherDoctors, setOtherDoctors] = useState<DoctorRecord[]>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active_consultation' | 'waiting_queue'>('active_consultation');
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Sync activeTab if a call is ongoing
  useEffect(() => {
    if (sessionState?.status === 'in_call' || sessionState?.status === 'matched') {
      setActiveTab('active_consultation');
      setDoctorStatus('busy');
    }
  }, [sessionState?.status]);

  // Handle doctor login
  const handleDoctorLogin = async (id: string, name: string, specialty: string) => {
    const profile = { id, name, specialty };
    setCurrentDoctor(profile);
    localStorage.setItem('clearconsult_doctor', JSON.stringify(profile));
    try {
      const res = await registerDoctor(id, name, specialty);
      setDoctorStatus(res.status);
    } catch (e) {
      console.warn('Doctor registration warning:', e);
    }
  };

  const handleLogout = () => {
    setCurrentDoctor(null);
    localStorage.removeItem('clearconsult_doctor');
  };

  // Heartbeat & Queue Polling
  const refreshClinicData = useCallback(async () => {
    if (!currentDoctor) return;
    try {
      // 1. Send 15s Heartbeat
      const hb = await sendDoctorHeartbeat(currentDoctor.id);
      if (hb && hb.status) {
        setDoctorStatus(hb.status);
      }

      // 2. Fetch Waiting Queue
      const q = await getWaitingQueue();
      setWaitingQueue(q);

      // 3. Fetch Doctors list
      const docs = await listDoctors();
      setOtherDoctors(docs);

      // 4. Fetch Recent Sessions
      const recents = await getDoctorRecentSessions(currentDoctor.id);
      setRecentSessions(recents);
    } catch (e) {
      console.warn('Clinic presence sync warning:', e);
    }
  }, [currentDoctor]);

  useEffect(() => {
    if (!currentDoctor) return;
    refreshClinicData();
    const interval = setInterval(refreshClinicData, 4000);
    return () => clearInterval(interval);
  }, [currentDoctor, refreshClinicData]);

  // Handle manual patient acceptance
  const handleAcceptPatient = async (targetSessionId: string) => {
    if (!currentDoctor) return;
    try {
      await acceptPatient(targetSessionId, currentDoctor.id);
      if (onSelectSession) {
        onSelectSession(targetSessionId);
      }
      setActiveTab('active_consultation');
      setDoctorStatus('busy');
      onRefresh();
    } catch (err: any) {
      alert(`Accept failed: ${err.message}`);
    }
  };

  // One-click demo seed
  const handleSeedDemo = async () => {
    try {
      await seedMultiRoomDemo();
      await refreshClinicData();
      setBannerNotice('Demo Multi-Room Seeded: 3 Clinicians & 4 Triage Queue Patients loaded!');
      setTimeout(() => setBannerNotice(null), 5000);
    } catch (err: any) {
      alert(`Seed failed: ${err.message}`);
    }
  };

  // If not logged in, prompt clinician ID
  if (!currentDoctor) {
    return <DoctorLoginModal onLogin={handleDoctorLogin} />;
  }

  const fields = sessionState?.extracted_fields;
  const needsAttention = sessionState?.needs_attention || [];
  const conversation = sessionState?.conversation_history || [];

  // Helper to render source badge
  const renderSourceChip = (source: ItemSource) => {
    switch (source) {
      case 'patient said':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-[4px] bg-[#f1f5f9] text-[#334155] border border-[#cbd5e1]">
            <Quote className="w-2.5 h-2.5 text-[#0f766e]" />
            <span>patient said</span>
          </span>
        );
      case 'measured':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-[4px] bg-[#f0fdfa] text-[#0f766e] border border-[#99f6e4]">
            <span>measured (estimate)</span>
          </span>
        );
      case 'inferred':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-[4px] bg-[#f8faf9] text-[#64748b] border border-[#e2e8f0]">
            <span>inferred</span>
          </span>
        );
    }
  };

  const formatValue = (val: any) => {
    if (val === null || val === undefined || val === '') return 'Not reported';
    if (Array.isArray(val)) {
      if (val.length === 0) return 'None recorded';
      return val.join(', ');
    }
    return String(val);
  };

  const fieldList: { key: string; label: string; field: ExtractedField }[] = fields
    ? [
        { key: 'chief_complaint', label: 'Chief Complaint', field: fields.chief_complaint },
        { key: 'duration', label: 'Duration', field: fields.duration },
        { key: 'onset', label: 'Onset', field: fields.onset },
        { key: 'severity', label: 'Severity (0-10)', field: fields.severity },
        { key: 'associated_symptoms', label: 'Associated Symptoms', field: fields.associated_symptoms },
        { key: 'relevant_negatives', label: 'Relevant Negatives', field: fields.relevant_negatives },
        { key: 'medications', label: 'Medications', field: fields.medications }
      ]
    : [];

  const knownItems = fieldList.filter((item) => item.field?.status === 'known');
  const unknownItems = fieldList.filter((item) => item.field?.status !== 'known');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 w-full">
      {/* Top Banner Notice */}
      {bannerNotice && (
        <div className="mb-4 p-3 rounded-[6px] bg-[#f0fdf4] border border-[#86efac] text-[#166534] text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#16a34a]" />
            <span>{bannerNotice}</span>
          </div>
          <button onClick={() => setBannerNotice(null)} className="text-[#15803d] hover:underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Clinician Station Header & Identity Bar */}
      <div className="bg-white p-4 rounded-[6px] border border-[#e2e8f0] shadow-xs mb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Clinician Profile */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0f766e]/10 text-[#0f766e] flex items-center justify-center border border-[#0f766e]/30 shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-[#0f172a] tracking-tight">
                {currentDoctor.name}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#0f766e] border border-[#cbd5e1] font-semibold">
                PeerJS ID: doctor-{currentDoctor.id}
              </span>
              {/* Presence Indicator */}
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded ${
                  doctorStatus === 'available'
                    ? 'bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]'
                    : doctorStatus === 'busy'
                    ? 'bg-[#fffbeb] text-[#b45309] border border-[#fef3c7]'
                    : 'bg-[#f8faf9] text-[#64748b] border border-[#e2e8f0]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    doctorStatus === 'available'
                      ? 'bg-[#16a34a] animate-pulse'
                      : doctorStatus === 'busy'
                      ? 'bg-[#f59e0b]'
                      : 'bg-[#94a3b8]'
                  }`}
                ></span>
                <span className="uppercase">{doctorStatus}</span>
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              {currentDoctor.specialty} • Active Session: <span className="font-mono text-[#0f172a]">{sessionId}</span>
            </p>
          </div>
        </div>

        {/* Quick Station Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSeedDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#f0fdfa] border border-[#99f6e4] text-[#0f766e] hover:bg-[#ccfbf1] text-xs font-semibold transition-colors shadow-xs"
            title="Seed 3 doctors and 4 waiting patients for presentation demo"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Seed 7-Person Demo Lobby</span>
          </button>

          <button
            onClick={() => loadTamilDemoScenario(sessionId).then(onRefresh)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-medium transition-colors shadow-xs"
          >
            <span>Run Tamil Acceptance</span>
          </button>

          <button
            onClick={() => resetSession(sessionId).then(onRefresh)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border border-[#cbd5e1] hover:bg-[#f8faf9] text-[#475569] text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Reset</span>
          </button>

          {onOpenSkinTriage && (
            <button
              onClick={onOpenSkinTriage}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border border-[#cbd5e1] hover:bg-[#f8faf9] text-[#0f766e] text-xs font-medium transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Skin Triage</span>
            </button>
          )}

          {onOpenGuides && (
            <button
              onClick={onOpenGuides}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] border border-[#cbd5e1] hover:bg-[#f8faf9] text-[#475569] text-xs font-medium transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Guides</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[4px] border border-[#fca5a5] hover:bg-[#fef2f2] text-[#b91c1c] text-xs font-medium transition-colors"
            title="Sign out of clinician station"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-[#cbd5e1] mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('active_consultation')}
            className={`pb-2.5 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'active_consultation'
                ? 'border-[#0f766e] text-[#0f766e]'
                : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Active Consultation Room</span>
            {sessionState?.status === 'in_call' && (
              <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('waiting_queue')}
            className={`pb-2.5 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'waiting_queue'
                ? 'border-[#0f766e] text-[#0f766e]'
                : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Patient Waiting Queue</span>
            <span className="px-2 py-0.5 rounded-[10px] bg-[#0f766e]/10 text-[#0f766e] text-[10px] font-mono font-bold">
              {waitingQueue.length}
            </span>
          </button>
        </div>

        {/* Live Clinic Roster Summary */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#64748b] pb-2">
          <Activity className="w-3.5 h-3.5 text-[#0f766e]" />
          <span>Clinic Doctors Online: <strong>{otherDoctors.filter((d) => d.status !== 'offline').length}</strong></span>
        </div>
      </div>

      {/* TAB 1: WAITING QUEUE PANEL */}
      {activeTab === 'waiting_queue' ? (
        <div className="space-y-6">
          <DoctorWaitingList
            queue={waitingQueue}
            doctorId={currentDoctor.id}
            isDoctorAvailable={doctorStatus === 'available'}
            onAcceptPatient={handleAcceptPatient}
            onSeedDemo={handleSeedDemo}
            isLoading={isLoading}
          />

          {/* Clinic Doctors Presence Registry */}
          <div className="bg-white border border-[#cbd5e1] rounded-[6px] shadow-xs p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0f172a] mb-3 flex items-center gap-1.5">
              <Stethoscope className="w-4 h-4 text-[#0f766e]" />
              <span>Clinic Clinicians & Status</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {otherDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-[4px] border border-[#e2e8f0] bg-[#fafcfb] flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-[#0f172a]">{doc.name}</div>
                    <div className="text-[10px] text-[#64748b]">{doc.specialty || 'General Medicine'}</div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      doc.status === 'available'
                        ? 'bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]'
                        : doc.status === 'busy'
                        ? 'bg-[#fffbeb] text-[#b45309] border border-[#fef3c7]'
                        : 'bg-slate-100 text-slate-500 border border-slate-300'
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: ACTIVE CONSULTATION ROOM */
        <div>
          {/* Emergency Alert Banner if present */}
          {sessionState?.is_emergency && (
            <div className="mb-6 p-4 rounded-[6px] bg-[#fef2f2] border border-[#fca5a5] text-[#991b1b] flex items-start gap-3 shadow-xs">
              <AlertOctagon className="w-5 h-5 text-[#dc2626] shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm">CRITICAL EMERGENCY DETECTED (RULE: SAFETY-EMERGENCY-112)</h2>
                </div>
                <p className="text-xs mt-1 text-[#7f1d1d]">
                  {sessionState.emergency_alert?.alert_message ||
                    'Patient reported life-threatening symptoms. Immediate emergency transfer / 112 escalation recommended.'}
                </p>
              </div>
            </div>
          )}

          {/* Grid Layout: Left = Video & Sidebar, Right = Three-State Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (5 cols): Video Call, Vitals, and Recent Sessions Sidebar */}
            <div className="lg:col-span-5 space-y-4">
              {/* Video Consultation Stream */}
              <VideoConsultation
                role="doctor"
                sessionId={sessionId}
                doctorId={currentDoctor.id}
                onCallEnded={() => {
                  setDoctorStatus('available');
                  refreshClinicData();
                }}
                onSessionDetected={(detectedSessionId) => {
                  if (detectedSessionId && onSelectSession) {
                    onSelectSession(detectedSessionId);
                  }
                }}
              />

              {/* Vitals Estimates (Phase 4) */}
              <VitalsEstimator patientReportedSeverity={sessionState?.extracted_fields?.severity?.severity_num || 8} />

              {/* Requirement 4: Sidebar listing that doctor's recent sessions */}
              <div className="bg-white border border-[#e2e8f0] rounded-[6px] shadow-xs overflow-hidden">
                <div className="bg-[#f8faf9] border-b border-[#e2e8f0] px-3.5 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0f172a] flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#0f766e]" />
                    <span>Recent Consultations ({recentSessions.length})</span>
                  </span>
                  <span className="text-[10px] text-[#64748b]">Dr. {currentDoctor.name.split(' ')[1] || 'Profile'}</span>
                </div>
                <div className="p-2.5 max-h-48 overflow-y-auto space-y-1.5 text-xs bg-[#fafcfb]">
                  {recentSessions.length === 0 ? (
                    <p className="text-[11px] text-[#94a3b8] italic text-center py-2">
                      No prior consultation history.
                    </p>
                  ) : (
                    recentSessions.map((rec, i) => (
                      <button
                        key={i}
                        onClick={() => onSelectSession?.(rec.session_id)}
                        className={`w-full text-left p-2 rounded-[4px] border text-xs flex items-center justify-between transition-colors ${
                          rec.session_id === sessionId
                            ? 'bg-[#f0fdfa] border-[#99f6e4] text-[#0f766e] font-semibold'
                            : 'bg-white border-[#e2e8f0] text-[#334155] hover:bg-[#f8faf9]'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="font-medium truncate">{rec.patient_name || rec.session_id}</div>
                          <div className="text-[10px] text-[#64748b] truncate">{rec.chief_complaint || 'Completed consultation'}</div>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">
                          {rec.status}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Patient Utterance Transcript */}
              <div className="bg-white border border-[#e2e8f0] rounded-[6px] shadow-xs overflow-hidden">
                <div className="bg-[#f8faf9] border-b border-[#e2e8f0] px-3.5 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0f172a] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0f766e]" />
                    <span>Patient Utterances & Transcript</span>
                  </span>
                  <span className="text-[10px] text-[#64748b] tabular-nums font-mono">
                    {conversation.length} events
                  </span>
                </div>
                <div className="p-3 max-h-56 overflow-y-auto space-y-2 text-xs bg-[#fafcfb]">
                  {conversation.length === 0 ? (
                    <p className="text-xs text-[#94a3b8] italic text-center py-3">
                      No conversation events recorded yet.
                    </p>
                  ) : (
                    conversation.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-2.5 rounded-[4px] border ${
                          msg.role === 'patient'
                            ? 'bg-white border-[#cbd5e1] text-[#0f172a]'
                            : 'bg-[#f0fdfa] border-[#ccfbf1] text-[#0f766e]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#64748b] mb-1">
                          <span className="font-semibold uppercase tracking-wider">
                            {msg.role === 'patient' ? 'Patient Utterance' : 'ClearConsult Follow-Up'}
                          </span>
                        </div>
                        <p className="leading-relaxed">{msg.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (7 cols): The Three-State Triage Panel & Doctor Note */}
            <div className="lg:col-span-7 space-y-6">
              {/* Three-State Panel Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#0f172a]">
                    Clinical Uncertainty & Missing Information Panel
                  </h2>
                  <p className="text-xs text-[#64748b]">
                    Categorizes patient intake into 3 explicit states. The doctor always decides.
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
                  Session: <code className="text-[#0f766e]">{sessionId}</code>
                </span>
              </div>

              {/* 1. STATE 3: NEEDS ATTENTION (Red Flags & Mismatches) */}
              <div className="bg-white border border-[#e2e8f0] rounded-[6px] shadow-xs overflow-hidden">
                <div className="bg-[#fff5f5] border-b border-[#fed7d7] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#dc2626]" />
                    <span className="text-xs font-bold uppercase tracking-wide text-[#991b1b]">
                      State 3: Needs Attention ({needsAttention.length})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-[#991b1b] border border-[#fca5a5]">
                    Deterministic Red Flags Only
                  </span>
                </div>

                <div className="p-4">
                  {needsAttention.length === 0 ? (
                    <p className="text-xs text-[#64748b] italic py-2">
                      No deterministic red flags triggered for current intake.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {needsAttention.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-[4px] border border-[#fca5a5] bg-[#fffbfb] flex items-start gap-3"
                        >
                          <AlertOctagon className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-[#991b1b]">
                                [{item.id}] {item.name}
                              </span>
                              <span className="text-[10px] uppercase font-bold text-[#b91c1c] bg-[#fee2e2] px-2 py-0.5 rounded-[4px]">
                                {item.severity_level}
                              </span>
                            </div>
                            <p className="text-xs text-[#7f1d1d] mt-1 leading-relaxed">
                              {item.message}
                            </p>
                            <span className="inline-block mt-2 text-[10px] font-medium text-[#991b1b]/70 bg-white px-2 py-0.5 rounded border border-[#fecaca]">
                              {item.source}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. STATE 1: KNOWN (Stated by patient or measured) */}
              <div className="bg-white border border-[#e2e8f0] rounded-[6px] shadow-xs overflow-hidden">
                <div className="bg-[#f0fdf4] border-b border-[#bbf7d0] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                    <span className="text-xs font-bold uppercase tracking-wide text-[#166534]">
                      State 1: Known Facts ({knownItems.length})
                    </span>
                  </div>
                  <span className="text-[10px] text-[#166534] font-medium">
                    Backed by verbatim patient evidence
                  </span>
                </div>

                <div className="p-4">
                  {knownItems.length === 0 ? (
                    <p className="text-xs text-[#64748b] italic py-2">
                      No clinical facts confirmed yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {knownItems.map((item) => (
                        <div
                          key={item.key}
                          className="p-3 rounded-[4px] border border-[#e2e8f0] bg-white flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-[#0f172a]">
                              {item.label}
                            </span>
                            {renderSourceChip(item.field.source)}
                          </div>
                          <div className="text-xs text-[#0f172a] font-medium">
                            {formatValue(item.field.value)}
                          </div>
                          {item.field.evidence && (
                            <div className="text-[11px] text-[#64748b] bg-[#f8faf9] p-2 rounded-[4px] border border-[#e2e8f0] italic flex items-start gap-1.5">
                              <Quote className="w-3 h-3 text-[#0f766e] shrink-0 mt-0.5" />
                              <span>"{item.field.evidence}"</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. STATE 2: UNKNOWN (Not yet asked or answered) */}
              <div className="bg-white border border-[#e2e8f0] rounded-[6px] shadow-xs overflow-hidden">
                <div className="bg-[#fffbeb] border-b border-[#fde68a] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#b45309]" />
                    <span className="text-xs font-bold uppercase tracking-wide text-[#92400e]">
                      State 2: Clinical Gaps / Unknown ({unknownItems.length})
                    </span>
                  </div>
                  <span className="text-[10px] text-[#92400e] font-medium">
                    Priority sorted follow-up
                  </span>
                </div>

                <div className="p-4">
                  {unknownItems.length === 0 ? (
                    <p className="text-xs text-[#166534] font-medium py-2">
                      All clinical intake fields have been addressed.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {unknownItems.map((item) => (
                        <div
                          key={item.key}
                          className="p-2.5 rounded-[4px] border border-[#fef3c7] bg-[#fffdfa] flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                            <span className="font-medium text-[#78350f]">{item.label}</span>
                          </div>
                          <span className="text-[10px] text-[#b45309] uppercase tracking-wider font-semibold">
                            Not yet asked / answered
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Phase 2: Structured Doctor Note & PDF Export */}
              <DoctorNotePanel
                sessionId={sessionId}
                doctorName={currentDoctor.name}
                onNoteUpdated={onRefresh}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
