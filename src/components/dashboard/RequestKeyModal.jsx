import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { baseUrl } from '../../apiBase';

const CATEGORIES = ['Station Name', 'Train Name', 'Train Type', 'Digit', 'Phrase', 'Uncategorized'];

export function RequestKeyModal({ open, onClose, onCreated }) {
  const [key, setKey] = useState('');
  const [category, setCategory] = useState('Uncategorized');
  const [knownKeys, setKnownKeys] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setKey('');
    setCategory('Uncategorized');
    setError(null);
    fetch(`${baseUrl}/api/audio-clips/known-keys`)
      .then((r) => r.json())
      .then(setKnownKeys)
      .catch(() => setKnownKeys([]));
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/audio-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), category }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-lg">Request a new recording</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audio key</label>
            <input
              list="known-keys-list"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. Vijayawada Junction, Pinakini, 4_tel"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <datalist id="known-keys-list">
              {knownKeys.map((k) => <option key={k} value={k} />)}
            </datalist>
            <p className="text-xs text-gray-400 mt-1">
              Must match exactly what the announcement generator looks up (station/train names come from real train data).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !key.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
            >
              {submitting ? 'Adding...' : 'Add to queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
