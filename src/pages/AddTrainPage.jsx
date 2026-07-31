import { useState, useEffect } from 'react';
import { baseUrl } from '../apiBase';
import { TrainForm } from '../components/trains/TrainForm';
import { AddTrainResult } from '../components/trains/AddTrainResult';
import { ExistingTrainsBrowser } from '../components/trains/ExistingTrainsBrowser';

export default function AddTrainPage() {
  const [fieldOptions, setFieldOptions] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [browserSearch, setBrowserSearch] = useState('');

  useEffect(() => {
    fetch(`${baseUrl}/api/trains/field-options`)
      .then((r) => r.json())
      .then(setFieldOptions)
      .catch(() => setFieldOptions({ stations: [], trainNames: [], trainTypes: [] }));
  }, []);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${baseUrl}/api/trains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || `Request failed (${res.status})`);
        if (res.status === 409) setBrowserSearch(payload.trainNo);
        return;
      }

      setSubmitResult(data);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAnother = () => {
    setSubmitResult(null);
    setSubmitError(null);
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Train</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Add a new train and its route. Reusing an existing station/name/type keeps its audio; anything new gets queued for recording.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            {submitResult ? (
              <AddTrainResult
                train={submitResult.train}
                audioStatus={submitResult.audioStatus}
                onAddAnother={handleAddAnother}
              />
            ) : (
              <TrainForm
                fieldOptions={fieldOptions}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitError={submitError}
              />
            )}
          </div>

          <div className="lg:col-span-3">
            <ExistingTrainsBrowser refreshKey={refreshKey} initialSearch={browserSearch} />
          </div>
        </div>
      </div>
    </div>
  );
}
