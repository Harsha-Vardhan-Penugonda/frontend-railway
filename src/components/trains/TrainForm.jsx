import { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

function MatchHint({ value, options }) {
  if (!value.trim()) return null;
  const matches = options?.includes(value.trim());
  return matches ? (
    <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
      <CheckCircle2 size={12} /> Matches existing audio - will be reused
    </p>
  ) : (
    <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
      <AlertCircle size={12} /> New key - will need a fresh recording
    </p>
  );
}

function Field({ label, id, value, onChange, options, listId, required, hint }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        list={listId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {options && <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>}
      {hint}
    </div>
  );
}

export function TrainForm({
  fieldOptions, onSubmit, submitting, submitError,
  initial = null, title = 'Add a new train', submitLabel = 'Add Train', submittingLabel = 'Adding...',
  onCancel = null, idPrefix = 'add',
}) {
  const [trainNo, setTrainNo] = useState(initial?.['Train No'] ?? '');
  const [from, setFrom] = useState(initial?.['FROM'] ?? '');
  const [to, setTo] = useState(initial?.['TO'] ?? '');
  const [trainName, setTrainName] = useState(initial?.['Train Name'] ?? '');
  const [trainType, setTrainType] = useState(initial?.['Train Type'] ?? '');
  const [warning, setWarning] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setWarning(null);

    const trimmed = {
      trainNo: trainNo.trim(),
      from: from.trim(),
      to: to.trim(),
      trainName: trainName.trim(),
      trainType: trainType.trim(),
    };

    if (!trimmed.trainNo || !trimmed.from || !trimmed.to) return;

    if (!/^\d{3,6}$/.test(trimmed.trainNo)) {
      setWarning('Heads up: train numbers are usually 3-6 digits - double check that before submitting.');
    }
    if (trimmed.from === trimmed.to) {
      setWarning((w) => (w ? w + ' Also, From and To are the same station.' : 'From and To are the same station - double check that.'));
    }

    onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-gray-900">{title}</h2>

      <Field label="Train Number" id={`${idPrefix}-trainNo`} value={trainNo} onChange={setTrainNo} required />

      <Field
        label="From Station" id={`${idPrefix}-from`} value={from} onChange={setFrom} required
        options={fieldOptions?.stations} listId={`${idPrefix}-stations-list`}
        hint={<MatchHint value={from} options={fieldOptions?.stations} />}
      />

      <Field
        label="To Station" id={`${idPrefix}-to`} value={to} onChange={setTo} required
        options={fieldOptions?.stations} listId={`${idPrefix}-stations-list-to`}
        hint={<MatchHint value={to} options={fieldOptions?.stations} />}
      />

      <Field
        label="Train Name (optional)" id={`${idPrefix}-trainName`} value={trainName} onChange={setTrainName}
        options={fieldOptions?.trainNames} listId={`${idPrefix}-train-names-list`}
        hint={<MatchHint value={trainName} options={fieldOptions?.trainNames} />}
      />

      <Field
        label="Train Type (optional)" id={`${idPrefix}-trainType`} value={trainType} onChange={setTrainType}
        options={fieldOptions?.trainTypes} listId={`${idPrefix}-train-types-list`}
        hint={<MatchHint value={trainType} options={fieldOptions?.trainTypes} />}
      />

      {warning && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {warning}
        </div>
      )}

      {submitError && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">{submitError}</div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-3 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || !trainNo.trim() || !from.trim() || !to.trim()}
          className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
