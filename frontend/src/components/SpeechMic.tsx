import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

interface SpeechMicProps {
  language: string; // 'en' | 'ta' | 'hi'
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export const SpeechMic: React.FC<SpeechMicProps> = ({ language, onTranscript, disabled }) => {
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Map language code to BCP-47 tag
  const getBcp47 = (lang: string) => {
    switch (lang) {
      case 'ta':
        return 'ta-IN';
      case 'hi':
        return 'hi-IN';
      default:
        return 'en-IN';
    }
  };

  useEffect(() => {
    // Check Web Speech API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg('Web Speech API not supported in this browser. Please type.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = getBcp47(language);

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          onTranscript(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
          setErrorMsg(`Voice input error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err: any) {
      setErrorMsg('Microphone initialization failed.');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [language]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.lang = getBcp47(language);
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Speech start error', err);
      }
    }
  };

  const getLanguageLabel = () => {
    if (language === 'ta') return 'தமிழ் (ta-IN)';
    if (language === 'hi') return 'हिन्दी (hi-IN)';
    return 'English (en-IN)';
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        className={`relative flex items-center gap-1.5 px-3 py-2 rounded-[6px] border text-xs font-medium transition-colors ${
          isListening
            ? 'bg-[#fef2f2] border-[#fca5a5] text-[#b91c1c] animate-pulse'
            : 'bg-white border-[#e2e8f0] text-[#334155] hover:bg-[#f8faf9]'
        } disabled:opacity-50`}
        title={`Speech recognition for ${getLanguageLabel()}`}
      >
        {isListening ? (
          <>
            <MicOff className="w-3.5 h-3.5 text-[#b91c1c]" />
            <span className="font-semibold">Listening ({getLanguageLabel()})...</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-[#0f766e]" />
            <span>Speak ({getLanguageLabel()})</span>
          </>
        )}
      </button>

      {errorMsg && (
        <span className="text-[11px] text-[#b45309] flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {errorMsg}
        </span>
      )}
    </div>
  );
};
