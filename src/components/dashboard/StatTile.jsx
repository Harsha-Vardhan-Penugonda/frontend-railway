export function StatTile({ label, value, icon: Icon, tone = 'default' }) {
  const toneStyles = {
    default: 'text-gray-900',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    gray: 'text-gray-500',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      {Icon && (
        <div className="shrink-0 h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center">
          <Icon className="h-4.5 w-4.5 text-gray-400" size={18} />
        </div>
      )}
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className={`text-xl font-semibold ${toneStyles[tone]}`}>{value}</p>
      </div>
    </div>
  );
}
