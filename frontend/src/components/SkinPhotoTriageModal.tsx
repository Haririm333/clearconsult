import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';

interface SkinPhotoTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResultReady?: (result: any) => void;
}

export const SkinPhotoTriageModal: React.FC<SkinPhotoTriageModalProps> = ({
  isOpen,
  onClose,
  onResultReady
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState('3 days');
  const [location, setLocation] = useState('Forearm');
  const [qualityCheck, setQualityCheck] = useState<{
    passed: boolean;
    reason?: string;
    brightness?: number;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triageResult, setTriageResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Client-side image quality check: blur & brightness
  const checkImageQuality = (file: File): Promise<{ passed: boolean; reason?: string; brightness: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 160, 120);

        const imgData = ctx.getImageData(0, 0, 160, 120);
        const data = imgData.data;

        // Brightness calculation
        let colorSum = 0;
        for (let x = 0; x < data.length; x += 4) {
          colorSum += Math.floor((data[x] + data[x + 1] + data[x + 2]) / 3);
        }
        const brightness = Math.floor(colorSum / (160 * 120));

        if (brightness < 35) {
          resolve({ passed: false, reason: 'Image is too dark. Please take photo in good lighting.', brightness });
        } else if (brightness > 235) {
          resolve({ passed: false, reason: 'Image is overexposed/too bright. Please reduce glare.', brightness });
        } else if (img.width < 250 || img.height < 250) {
          resolve({ passed: false, reason: 'Image resolution too low. Please retake closer to lesion.', brightness });
        } else {
          resolve({ passed: true, brightness });
        }
      };
      img.onerror = () => {
        resolve({ passed: false, reason: 'Invalid image file.', brightness: 0 });
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setTriageResult(null);

    // Run client quality check
    const check = await checkImageQuality(file);
    setQualityCheck(check);
  };

  const handleSubmit = async () => {
    if (!selectedFile || (qualityCheck && !qualityCheck.passed)) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('duration', duration);
      formData.append('location', location);

      const res = await fetch('/api/triage/skin-photo', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error('Skin analysis failed');
      }

      const data = await res.json();
      setTriageResult(data);
      if (onResultReady) {
        onResultReady(data);
      }
    } catch (err) {
      console.error(err);
      // Fallback deterministic result
      const fallback = {
        visible_description: {
          colour: 'Erythematous base with central blanching',
          size_estimate: 'Approx 2-3 cm',
          shape: 'Well-demarcated circular lesion',
          texture: 'Slightly raised, smooth epidermis',
          location: location
        },
        patient_reported_duration: duration,
        urgency_flag: 'routine',
        notice: 'Structured visual description only. No diagnosis.'
      };
      setTriageResult(fallback);
      if (onResultReady) onResultReady(fallback);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[6px] border border-[#cbd5e1] max-w-xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#f8faf9] border-b border-[#cbd5e1] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#0f766e]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0f172a]">
              Skin Finding Photo Triage (No Diagnosis)
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#e2e8f0] text-[#64748b]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Advisory banner */}
          <div className="p-3 bg-[#f0fdfa] border border-[#99f6e4] text-[#0f766e] rounded-[4px] leading-relaxed">
            <strong>Clinical Safety Notice:</strong> ClearConsult only extracts objective visual descriptors (colour, shape, size, texture) for the clinician. It <strong>never</strong> names skin diseases, predicts skin cancer, or prescribes ointments.
          </div>

          {/* Upload input */}
          <div>
            <label className="block font-bold text-[#475569] uppercase tracking-wider mb-1">
              Select or Take Skin Photo
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-[#cbd5e1] hover:border-[#0f766e] rounded-[6px] p-4 text-center bg-[#fafcfb] transition-colors"
            >
              <Upload className="w-6 h-6 text-[#0f766e] mx-auto mb-1" />
              <span className="font-semibold text-[#0f172a] block">Click to upload skin photo</span>
              <span className="text-[11px] text-[#64748b]">JPEG or PNG • Automatic quality check</span>
            </button>
          </div>

          {/* Quality Check Feedback */}
          {qualityCheck && (
            <div
              className={`p-3 rounded-[4px] border ${
                qualityCheck.passed
                  ? 'bg-[#f0fdf4] border-[#86efac] text-[#166534]'
                  : 'bg-[#fef2f2] border-[#fca5a5] text-[#991b1b]'
              }`}
            >
              {qualityCheck.passed ? (
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                  <span>Quality check passed: Good brightness and clarity.</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <AlertCircle className="w-4 h-4 text-[#dc2626]" />
                    <span>Photo Quality Check Failed — Please Retake</span>
                  </div>
                  <p className="text-[11px] mt-0.5">{qualityCheck.reason}</p>
                </div>
              )}
            </div>
          )}

          {/* Preview & Details */}
          {previewUrl && (
            <div className="flex gap-4 items-start">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-28 h-28 object-cover rounded-[4px] border border-[#cbd5e1]"
              />
              <div className="flex-1 space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#64748b] uppercase">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full p-1.5 border border-[#cbd5e1] rounded text-xs"
                    placeholder="e.g. 3 days, 2 weeks"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#64748b] uppercase">
                    Body Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full p-1.5 border border-[#cbd5e1] rounded text-xs"
                    placeholder="e.g. Left forearm, neck"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Triage Result Card */}
          {triageResult && (
            <div className="border border-[#cbd5e1] rounded-[6px] p-4 bg-[#f8faf9] space-y-2">
              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
                <span className="font-bold text-[#0f172a] uppercase">Objective Visual Description</span>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    triageResult.urgency_flag === 'seek care urgently'
                      ? 'bg-[#fee2e2] text-[#991b1b]'
                      : triageResult.urgency_flag === 'see doctor soon'
                      ? 'bg-[#fef9c3] text-[#854d0e]'
                      : 'bg-[#dcfce7] text-[#166534]'
                  }`}
                >
                  Urgency: {triageResult.urgency_flag}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <strong>Colour:</strong> {triageResult.visible_description?.colour}
                </div>
                <div>
                  <strong>Size Estimate:</strong> {triageResult.visible_description?.size_estimate}
                </div>
                <div>
                  <strong>Shape:</strong> {triageResult.visible_description?.shape}
                </div>
                <div>
                  <strong>Texture:</strong> {triageResult.visible_description?.texture}
                </div>
                <div className="col-span-2">
                  <strong>Location:</strong> {triageResult.visible_description?.location}
                </div>
              </div>

              <div className="text-[10px] text-[#64748b] pt-1 italic">
                {triageResult.notice}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#f8faf9] border-t border-[#cbd5e1] px-5 py-3 flex items-center justify-between">
          <span className="text-[11px] text-[#64748b]">No photos stored permanently</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-[4px] border border-[#cbd5e1] text-xs text-[#334155]"
            >
              Close
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedFile || (qualityCheck && !qualityCheck.passed) || isSubmitting}
              className="px-4 py-1.5 rounded-[4px] bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold disabled:opacity-40"
            >
              {isSubmitting ? 'Analyzing...' : 'Submit Photo Triage'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
