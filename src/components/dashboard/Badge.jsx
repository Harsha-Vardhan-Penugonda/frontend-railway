const STATUS_STYLES = {
  recorded: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  archived: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

const CATEGORY_STYLES = {
  'Station Name': 'bg-blue-50 text-blue-700 ring-blue-600/20',
  'Train Name': 'bg-purple-50 text-purple-700 ring-purple-600/20',
  'Train Type': 'bg-pink-50 text-pink-700 ring-pink-600/20',
  'Digit': 'bg-teal-50 text-teal-700 ring-teal-600/20',
  'Phrase': 'bg-orange-50 text-orange-700 ring-orange-600/20',
  'Uncategorized': 'bg-gray-50 text-gray-500 ring-gray-500/20',
};

export function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${style}`}>
      {status}
    </span>
  );
}

export function CategoryBadge({ category }) {
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.Uncategorized;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {category || 'Uncategorized'}
    </span>
  );
}
