import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Upload, Loader2 } from 'lucide-react';
import { baseUrl } from '../apiBase';
import { silenceTrimLabel } from '../utils/format';
import { useFFmpeg } from '../hooks/useFFmpeg';

export default function RecordPage() {
  const { key } = useParams();

  const [isRecording, setIsRecording] = useState(false);
  const [rawBlobUrl, setRawBlobUrl] = useState(null);
  const [enhancedBlob, setEnhancedBlob] = useState(null);
  const [enhancedPreviewUrl, setEnhancedPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [micError, setMicError] = useState(null);
  const [minSilenceSeconds, setMinSilenceSeconds] = useState(0.2);
  const [clientProcessingUnavailable, setClientProcessingUnavailable] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const rawBlobRef = useRef(null);
  const fileInputRef = useRef(null);

  const { load, loaded, loading, processing, progress, statusMessage, processAudio } = useFFmpeg();

  // Preload the audio engine as soon as the page opens, so it's likely ready
  // by the time the user finishes recording/reviewing. If the CDN it loads
  // from is unreachable, fall back to the server doing the processing
  // instead of leaving the user stuck with no way to save at all.
  useEffect(() => {
    load().catch(() => setClientProcessingUnavailable(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickSupportedMimeType = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
  };

  const resetOutputs = () => {
    setEnhancedBlob(null);
    setEnhancedPreviewUrl(null);
    setSaved(false);
    setError(null);
  };

  const startRecording = useCallback(async () => {
    setError(null);
    setMicError(null);
    setRawBlobUrl(null);
    resetOutputs();
    chunksRef.current = [];

    if (!window.MediaRecorder) {
      setMicError('This browser does not support in-browser recording. Try Chrome/Edge/Firefox, or use "Upload an audio file instead" below.');
      return;
    }

    try {
      // The processing pipeline (client or server) handles noise reduction
      // and normalization itself, so we ask the browser for the rawest
      // possible capture instead of letting its own DSP fight with ours.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });

      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = (e) => {
        setError('Recording error: ' + (e.error?.message || 'unknown error'));
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());

        if (chunksRef.current.length === 0) {
          setError('No audio was captured - try recording again and speak for at least a second before stopping.');
          return;
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        rawBlobRef.current = blob;
        setRawBlobUrl(URL.createObjectURL(blob));
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setMicError('Could not access the microphone: ' + err.message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    resetOutputs();
    rawBlobRef.current = file;
    setRawBlobUrl(URL.createObjectURL(file));
  };

  const handleEnhance = async () => {
    if (!rawBlobRef.current) return;
    setError(null);
    setSaved(false);

    // Fallback path: client-side engine never loaded (e.g. CDN unreachable).
    // Upload the raw recording and let the server do the same processing.
    if (clientProcessingUnavailable) {
      setSaving(true);
      try {
        const formData = new FormData();
        formData.append('audio', rawBlobRef.current, rawBlobRef.current.name || 'recording.webm');
        formData.append('minSilenceSeconds', String(minSilenceSeconds));

        const res = await fetch(`${baseUrl}/api/audio-clips/${encodeURIComponent(key)}/enhance`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Enhance failed (${res.status})`);

        setEnhancedPreviewUrl(`${baseUrl}/api/audio-clips/${encodeURIComponent(key)}/audio?t=${Date.now()}`);
        setSaved(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    // Normal path: process in-browser first so what's previewed is exactly
    // what gets saved, then upload the already-processed result.
    try {
      if (!loaded) await load();
      const blob = await processAudio(rawBlobRef.current, {
        noiseReduction: 'medium',
        silenceRemoval: true,
        normalization: true,
        minSilenceSeconds,
      });
      setEnhancedBlob(blob);
      setEnhancedPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError('Processing failed: ' + err.message);
    }
  };

  const handleSave = async () => {
    if (!enhancedBlob) return;
    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', enhancedBlob, 'enhanced.mp3');
      formData.append('skipProcessing', 'true');

      const res = await fetch(`${baseUrl}/api/audio-clips/${encodeURIComponent(key)}/enhance`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);

      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isProcessing = loading || processing;

  return (
    <div className="bg-gray-100 font-sans min-h-screen p-4">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div>
          <Link to="/admin" className="text-sm text-blue-600 hover:underline">&larr; Back to dashboard</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">Record: <span className="text-blue-600">{key}</span></h1>
          <p className="text-gray-500 mt-1 text-sm">Record or upload, review, enhance, then save.</p>
          {clientProcessingUnavailable && (
            <p className="text-xs text-amber-600 mt-1">Audio engine unavailable - falling back to server-side processing.</p>
          )}
        </div>

        {micError && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">{micError}</div>
        )}

        <div className="flex justify-center">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="bg-red-600 text-white font-semibold px-6 py-3 rounded-full hover:bg-red-700"
            >
              ● Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-gray-700 text-white font-semibold px-6 py-3 rounded-full hover:bg-gray-800 animate-pulse"
            >
              ■ Stop Recording
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 h-px bg-gray-200" />
          or
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
        >
          <Upload size={16} /> Upload an audio file instead
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFilePicked} />

        {rawBlobUrl && (
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Review before enhancing</h2>
            <audio src={rawBlobUrl} controls className="w-full" />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="silence-slider" className="text-xs font-medium text-gray-600">
                  Silence trim: {silenceTrimLabel(minSilenceSeconds)}
                </label>
                <span className="text-xs text-gray-400">{minSilenceSeconds.toFixed(2)}s min pause</span>
              </div>
              <input
                id="silence-slider"
                type="range"
                min={0.05}
                max={1.0}
                step={0.05}
                value={minSilenceSeconds}
                onChange={(e) => setMinSilenceSeconds(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>Aggressive (cuts short pauses too)</span>
                <span>Gentle (only long dead air)</span>
              </div>
            </div>

            <button
              onClick={handleEnhance}
              disabled={isProcessing || saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
            >
              {isProcessing && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Loading audio engine...' : processing ? `${statusMessage} (${progress}%)` : 'Enhance'}
            </button>
            <p className="text-xs text-gray-400 text-center">Not happy with it? Record again or pick a different file before enhancing.</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {enhancedPreviewUrl && !clientProcessingUnavailable && (
          <div className="border-t border-gray-200 pt-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Preview enhanced result</h2>
            <audio src={enhancedPreviewUrl} controls className="w-full" />
            {!saved ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                {saving ? 'Saving...' : 'Save as live clip'}
              </button>
            ) : (
              <p className="text-sm font-semibold text-green-700 text-center">Saved!</p>
            )}
          </div>
        )}

        {enhancedPreviewUrl && clientProcessingUnavailable && saved && (
          <div className="border-t border-gray-200 pt-4 space-y-2">
            <h2 className="text-sm font-semibold text-green-700">Saved! Here's the enhanced result:</h2>
            <audio src={enhancedPreviewUrl} controls className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
