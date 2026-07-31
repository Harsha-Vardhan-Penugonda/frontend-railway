import { Mic, CheckCircle2 } from 'lucide-react';
import { CategoryBadge } from '../dashboard/Badge';

export function AddTrainResult({ train, audioStatus, onAddAnother }) {
  const needsRecording = audioStatus.filter((a) => a.status !== 'recorded');

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 text-emerald-700">
        <CheckCircle2 size={20} />
        <h2 className="font-semibold">Train {train['Train No']} added</h2>
      </div>
      <p className="text-sm text-gray-600">
        {train['Train Name'] ? `${train['Train Name']} - ` : ''}{train['FROM']} &rarr; {train['TO']}
        {train['Train Type'] ? ` (${train['Train Type']})` : ''}
      </p>

      <div className="border-t border-gray-100 pt-4 space-y-2">
        <p className="text-xs font-medium text-gray-500 mb-2">Audio for this train</p>
        {audioStatus.map((a) => (
          <div key={a.key} className="flex items-center justify-between gap-3 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <CategoryBadge category={a.category} />
              <span className="text-sm text-gray-800 truncate">{a.key}</span>
            </div>
            {a.status === 'recorded' ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 shrink-0">
                <CheckCircle2 size={14} /> Audio ready
              </span>
            ) : (
              <a
                href={`/record/${encodeURIComponent(a.key)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full hover:bg-amber-100 shrink-0"
              >
                <Mic size={12} /> Pending - Record now
              </a>
            )}
          </div>
        ))}
      </div>

      {needsRecording.length > 0 && (
        <p className="text-xs text-gray-400">
          {needsRecording.length} clip{needsRecording.length > 1 ? 's' : ''} still need recording. Links open in a new tab so you don't lose this page.
        </p>
      )}

      <button
        onClick={onAddAnother}
        className="w-full px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
      >
        Add another train
      </button>
    </div>
  );
}
