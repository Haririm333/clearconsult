import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Shield,
  RefreshCw
} from 'lucide-react';
import Peer from 'peerjs';
import { getWebRTCConfig, endConsultation, startCall } from '../api';
import type { WebRTCConfig } from '../types';

interface VideoConsultationProps {
  role: 'doctor' | 'patient';
  sessionId: string;
  doctorId?: string;
  targetDoctorPeerId?: string;
  onStreamReady?: (stream: MediaStream) => void;
  onCallEnded?: () => void;
  onSessionDetected?: (sessionId: string) => void;
}

export const VideoConsultation: React.FC<VideoConsultationProps> = ({
  role,
  sessionId,
  doctorId,
  targetDoctorPeerId,
  onStreamReady,
  onCallEnded,
  onSessionDetected
}) => {
  const [hasConsent, setHasConsent] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [reconnectSeconds, setReconnectSeconds] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'initializing' | 'waiting' | 'connected' | 'reconnecting' | 'error'
  >('idle');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<any>(null);
  const reconnectTimerRef = useRef<any>(null);

  // Requirement 1 & 3: Doctor's PeerJS ID is 'doctor-<id>'
  const cleanSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanDoctorId = doctorId ? doctorId.replace(/[^a-zA-Z0-9_-]/g, '') : null;
  
  const myPeerId = role === 'doctor'
    ? (cleanDoctorId ? `doctor-${cleanDoctorId}` : `doctor-${cleanSession}`)
    : `patient-${cleanSession}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const targetPeerId = targetDoctorPeerId || (cleanDoctorId ? `doctor-${cleanDoctorId}` : `doctor-${cleanSession}`);

  // Helper to generate synthetic stream if physical webcam is inaccessible
  const createSyntheticStream = (): MediaStream => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    let frame = 0;

    const draw = () => {
      frame++;
      // Clinical background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Gradient accent
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#0f766e');
      grad.addColorStop(1, '#042f2e');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(320, 200, 70, 0, Math.PI * 2);
      ctx.fill();

      // Clinical silhouette body
      ctx.beginPath();
      ctx.ellipse(320, 360, 110, 80, 0, 0, Math.PI * 2);
      ctx.fill();

      // Breathing rate subtle vertical motion indicator
      const breathOffset = Math.sin(frame * 0.05) * 6;
      ctx.fillStyle = '#14b8a6';
      ctx.beginPath();
      ctx.arc(320, 310 + breathOffset, 8, 0, Math.PI * 2);
      ctx.fill();

      // Text label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${role === 'doctor' ? 'Clinician Stream' : 'Patient Video'} (Synthetic Test Stream)`,
        320,
        440
      );

      requestAnimationFrame(draw);
    };
    draw();

    // 30 FPS canvas stream
    const canvasStream = (canvas as any).captureStream(30);

    // Add silent audio track
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass();
        const osc = audioCtx.createOscillator();
        const dst = (audioCtx as any).createMediaStreamDestination();
        osc.connect(dst);
        osc.start();
        const audioTrack = dst.stream.getAudioTracks()[0];
        if (audioTrack) {
          canvasStream.addTrack(audioTrack);
        }
      }
    } catch (_) {}

    return canvasStream;
  };

  const startMediaAndCall = async () => {
    setConnectionStatus('initializing');

    let stream: MediaStream;
    try {
      // Request user webcam/mic
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });
    } catch (err: any) {
      console.warn('Physical camera unavailable or permission denied, using synthetic test stream:', err);
      stream = createSyntheticStream();
    }

    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    if (onStreamReady) {
      onStreamReady(stream);
    }

    // Fetch dynamic WebRTC configuration (STUN + TURN)
    let webrtcConfig: WebRTCConfig = {
      ice_servers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      peerjs_host: null,
      peerjs_port: null,
      peerjs_path: null
    };
    try {
      webrtcConfig = await getWebRTCConfig();
    } catch (_) {}

    const peerOpts: any = {
      debug: 1,
      config: {
        iceServers: webrtcConfig.ice_servers
      }
    };
    if (webrtcConfig.peerjs_host) {
      peerOpts.host = webrtcConfig.peerjs_host;
      peerOpts.port = webrtcConfig.peerjs_port || 9000;
      peerOpts.path = webrtcConfig.peerjs_path || '/';
    }

    // Initialize PeerJS
    try {
      if (peerRef.current) {
        peerRef.current.destroy();
      }

      const peer = new Peer(myPeerId, peerOpts);

      peer.on('open', () => {
        setConnectionStatus('waiting');
        setCallActive(true);

        // If patient, attempt to call doctor with metadata
        if (role === 'patient') {
          setTimeout(() => {
            initiateCall(peer, stream);
          }, 1200);
        }
      });

      // Handle incoming call with session metadata
      peer.on('call', (incomingCall) => {
        const metaSessionId = incomingCall.metadata?.sessionId;
        if (metaSessionId && onSessionDetected) {
          onSessionDetected(metaSessionId);
        }

        incomingCall.answer(stream);
        callRef.current = incomingCall;
        startCall(metaSessionId || sessionId).catch(() => {});

        incomingCall.on('stream', (remoteStream: MediaStream) => {
          if (reconnectTimerRef.current) {
            clearInterval(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
            setReconnectSeconds(null);
          }
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
          setConnectionStatus('connected');
        });

        incomingCall.on('close', () => {
          // Reconnection grace period (60s)
          handleStreamDrop();
        });
      });

      peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id') {
          const fallbackPeer = new Peer(peerOpts);
          fallbackPeer.on('open', () => {
            setConnectionStatus('waiting');
            setCallActive(true);
            fallbackPeer.on('call', (c) => {
              c.answer(stream);
              c.on('stream', (rStream) => {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = rStream;
                setConnectionStatus('connected');
              });
            });
          });
          peerRef.current = fallbackPeer;
        } else {
          console.warn('PeerJS status:', err);
        }
      });

      peerRef.current = peer;
    } catch (e: any) {
      console.warn('Video call signaling initialization failed:', e);
      setConnectionStatus('error');
    }
  };

  const handleStreamDrop = () => {
    setConnectionStatus('reconnecting');
    setReconnectSeconds(60);
    if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);

    reconnectTimerRef.current = setInterval(() => {
      setReconnectSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(reconnectTimerRef.current);
          handleEndCall();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const initiateCall = (peer: Peer, stream: MediaStream) => {
    try {
      // Pass { metadata: { sessionId } } so doctor opens the matched session
      const outgoingCall = peer.call(targetPeerId, stream, {
        metadata: { sessionId }
      });
      if (outgoingCall) {
        callRef.current = outgoingCall;
        startCall(sessionId).catch(() => {});

        outgoingCall.on('stream', (remoteStream: MediaStream) => {
          if (reconnectTimerRef.current) {
            clearInterval(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
            setReconnectSeconds(null);
          }
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
          setConnectionStatus('connected');
        });

        outgoingCall.on('close', () => {
          handleStreamDrop();
        });
      }
    } catch (e) {
      console.warn('Call attempt:', e);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = !t.enabled));
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((t) => (t.enabled = !t.enabled));
      setCameraOff(!cameraOff);
    }
  };

  const handleEndCall = async () => {
    if (reconnectTimerRef.current) {
      clearInterval(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (callRef.current) {
      try {
        callRef.current.close();
      } catch (_) {}
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    try {
      await endConsultation(sessionId);
    } catch (_) {}

    setCallActive(false);
    setConnectionStatus('idle');
    setReconnectSeconds(null);
    onCallEnded?.();
  };

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="bg-white border border-[#cbd5e1] rounded-[6px] shadow-xs overflow-hidden">
      {/* Video Call Header */}
      <div className="bg-[#f8faf9] border-b border-[#cbd5e1] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-[#0f766e]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#0f172a]">
            {role === 'doctor' ? 'Patient Video Consultation Stream' : 'Live Clinician Video Stream'}
          </span>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'reconnecting' ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded bg-[#fef2f2] text-[#b91c1c] border border-[#fca5a5]">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              <span>Reconnecting ({reconnectSeconds}s grace)</span>
            </span>
          ) : connectionStatus === 'connected' ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse"></span>
              <span>Encrypted WebRTC Connected</span>
            </span>
          ) : connectionStatus === 'waiting' ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded bg-[#fffbeb] text-[#b45309] border border-[#fef3c7]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-ping"></span>
              <span>Awaiting Peer</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono text-[#64748b]">PeerJS WebRTC</span>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative bg-[#0f172a] aspect-video flex items-center justify-center overflow-hidden">
        {/* Pre-Call Consent Barrier */}
        {!hasConsent && !callActive ? (
          <div className="p-6 text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-[#0f766e]/20 text-[#2dd4bf] flex items-center justify-center mx-auto mb-3 border border-[#0f766e]/40">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">
              Camera & Audio Consultation Consent
            </h3>
            <p className="text-xs text-[#94a3b8] mt-1.5 leading-relaxed">
              Camera feed is streamed directly peer-to-peer via encrypted WebRTC. Zero video or audio is recorded or stored on any server.
            </p>
            <button
              onClick={() => {
                setHasConsent(true);
                startMediaAndCall();
              }}
              className="mt-4 px-4 py-2 rounded-[4px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold transition-colors shadow-xs"
            >
              Start Consultation Call
            </button>
          </div>
        ) : (
          <>
            {/* Remote Peer Video Stream */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover ${
                connectionStatus === 'connected' ? 'block' : 'hidden'
              }`}
            />

            {/* If remote stream waiting */}
            {connectionStatus !== 'connected' && (
              <div className="text-center p-6 text-[#94a3b8]">
                <Video className="w-8 h-8 mx-auto mb-2 text-[#475569] animate-pulse" />
                <p className="text-xs font-medium text-[#e2e8f0]">
                  {role === 'doctor'
                    ? 'Waiting for patient to connect video...'
                    : 'Connecting to clinician room...'}
                </p>
                <p className="text-[11px] text-[#64748b] mt-1">
                  Peer ID: <code className="font-mono text-[#2dd4bf]">{myPeerId}</code>
                </p>
              </div>
            )}

            {/* Local Video Thumbnail Overlay (Picture-in-Picture) */}
            <div className="absolute bottom-3 right-3 w-28 h-20 sm:w-36 sm:h-24 rounded-[4px] border border-white/20 bg-black overflow-hidden shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1 rounded">
                You ({role})
              </div>
            </div>
          </>
        )}
      </div>

      {/* Video Controls Bar */}
      {callActive && (
        <div className="bg-[#1e293b] p-3 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
                isMuted
                  ? 'bg-[#ef4444] text-white'
                  : 'bg-[#334155] hover:bg-[#475569] text-[#e2e8f0]'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'Muted' : 'Mute'}</span>
            </button>

            {/* Camera Toggle Button */}
            <button
              onClick={toggleCamera}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
                cameraOff
                  ? 'bg-[#ef4444] text-white'
                  : 'bg-[#334155] hover:bg-[#475569] text-[#e2e8f0]'
              }`}
              title={cameraOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {cameraOff ? (
                <VideoOff className="w-3.5 h-3.5" />
              ) : (
                <Video className="w-3.5 h-3.5" />
              )}
              <span>{cameraOff ? 'Camera Off' : 'Camera'}</span>
            </button>
          </div>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call</span>
          </button>
        </div>
      )}
    </div>
  );
};
