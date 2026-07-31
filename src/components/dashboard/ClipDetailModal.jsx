import { useState, useEffect, useRef } from 'react';
import { X, Mic, Upload, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { baseUrl } from '../../apiBase';
import { StatusBadge, CategoryBadge } from './Badge';
import { ConfirmDialog } from './ConfirmDialog';
import { formatDuration, formatBytes, formatDate, silenceTrimLabel } from '../../utils/format';

const CATEGORIES = ['Station Name', 'Train Name', 'Train Type', 'Digit', 'Phrase', 'Uncategorized'];

export function ClipDetailModal({ clipKey, onClose, onChanged }) {
  const [clip, setClip] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [audioCacheBust, setAudioCacheBust] = useState(Date.now());
  const [minSilenceSeconds, setMinSilenceSeconds] = useState(0.2);
  const fileInputRef = useRef(null);

  const load = async () => {
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/audio-clips/${encodeURIComponent(clipKey)}`);
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setClip(await res.json());
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (clipKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipKey]);

  if (!clipKey) return null;

  const handleCategoryChange = async (category) => {
    const res = await fetch(`${baseUrl}/api/audio-clips/${encodeURIComponent(clipKey)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    if (res.ok) {
      setClip(await res.json());
      onChanged?.();
    }
  };

  const handleArchiveToggle = async () => {
    const nextStatus = clip.status === 'archived' ? 'recorded' : 'archived';
    const res = await fetch(`${baseUrl}/api/audio-clips/${encodeURIComponent(clipKey)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      setClip(await res.json());
      onChanged?.();
    }
  };

  const handleDelete = async () => {
    await fetch(`${baseUrl}/api/audio-clips/${encodeURIComponent(clipKey)}`, { method: 'DELETE' });
    setConfirmDelete(false);
    onChanged?.();
    onClose();
  };

  const handleFileReplace = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('minSilenceSeconds', String(minSilenceSeconds));
      const res = await fetch(`${baseUrl}/api/audio-clips/${encodeURIComponent(clipKey)}/enhance`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      setClip(await res.json());
      setAudioCacheBust(Date.now());
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-semibold text-gray-900 text-lg truncate pr-4">{clipKey}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={20} />
          </button>
        </div>

        {!clip ? (
          <div className="p-6 text-sm text-gray-500">{error || 'Loading...'}</div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-2">
              <StatusBadge status={clip.status} />
              <CategoryBadge category={clip.category} />
              {clip.version > 0 && <span className="text-xs text-gray-400">v{clip.version}</span>}
            </div>

            {clip.status !== 'pending' && (
              <audio
                key={audioCacheBust}
                src={`${baseUrl}/api/audio-clips/${encodeURIComponent(clipKey)}/audio?t=${audioCacheBust}`}
                controls
                className="w-full"
              />
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-400">Duration</dt>
                <dd className="font-medium text-gray-800">{formatDuration(clip.durationSeconds)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">File size</dt>
                <dd className="font-medium text-gray-800">{formatBytes(clip.fileSizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Requested</dt>
                <dd className="font-medium text-gray-800">{formatDate(clip.requestedAt)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Last recorded</dt>
                <dd className="font-medium text-gray-800">{formatDate(clip.recordedAt)}</dd>
              </div>
            </dl>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select
                value={clip.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="border-t border-gray-100 pt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500 mb-1">Replace recording</p>

              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="detail-silence-slider" className="text-xs text-gray-500">
                    Silence trim on upload: <span className="font-medium text-gray-700">{silenceTrimLabel(minSilenceSeconds)}</span>
                  </label>
                  <span className="text-xs text-gray-400">{minSilenceSeconds.toFixed(2)}s min pause</span>
                </div>
                <input
                  id="detail-silence-slider"
                  type="range"
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={minSilenceSeconds}
                  onChange={(e) => setMinSilenceSeconds(parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/record/${encodeURIComponent(clipKey)}`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Mic size={16} /> Record
                </Link>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload file'}
                </button>
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileReplace} />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleArchiveToggle}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                {clip.status === 'archived' ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                {clip.status === 'archived' ? 'Unarchive' : 'Archive'}
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this recording?"
        message={`This permanently removes "${clipKey}" and its audio. This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
