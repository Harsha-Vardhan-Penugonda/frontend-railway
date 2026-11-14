import { useState, useEffect } from 'react';
import { baseUrl } from '../../apiBase';
import { TrainForm } from './TrainForm';
import { AddTrainResult } from './AddTrainResult';

// Edits an existing train's number, route (from/to), name and type. On save
// it shows the same audio-status summary as adding a train, so any station
// or name that's new to the system can be recorded straight away.
export function EditTrainModal({ train, fieldOptions, onClose, onSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    // Escape inside a text field just dismisses the browser's station/name
    // suggestion list - it shouldn't also throw away the whole edit.
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (e.target instanceof HTMLInputElement) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${baseUrl}/api/trains/${encodeURIComponent(train['Train No'])}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || `Request failed (${res.status})`);
        return;
      }
      setResult(data);
      onSaved();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Edit train ${train['Train No']}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl shadow-xl">
        {result ? (
          <AddTrainResult
            train={result.train}
            audioStatus={result.audioStatus}
            onAddAnother={onClose}
            verb="updated"
            doneLabel="Done"
          />
        ) : (
          <TrainForm
            fieldOptions={fieldOptions}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitError={submitError}
            initial={train}
            title={`Edit train ${train['Train No']}`}
            submitLabel="Save changes"
            submittingLabel="Saving..."
            onCancel={onClose}
            idPrefix="edit"
          />
        )}
      </div>
    </div>
  );
}
