import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { baseUrl } from '../../apiBase';
import { useDebounced } from '../../hooks/useDebounced';

export function ExistingTrainsBrowser({ refreshKey, initialSearch = '' }) {
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounced(search, 300);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);
  useEffect(() => { setPage(1); }, [debouncedSearch, refreshKey]);

  const fetchTrains = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ search: debouncedSearch, page: String(page), limit: String(limit) });
      const res = await fetch(`${baseUrl}/api/trains?${params}`);
      if (!res.ok) throw new Error(`Failed to load trains (${res.status})`);
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, refreshKey]);

  useEffect(() => { fetchTrains(); }, [fetchTrains]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search existing trains by number/name/station..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            aria-label="Search existing trains"
          />
        </div>
      </div>

      {error && <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-100">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="px-3 py-2.5 font-medium">Train No</th>
              <th className="px-3 py-2.5 font-medium">Name</th>
              <th className="px-3 py-2.5 font-medium">From &rarr; To</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400">No trains found.</td></tr>
            ) : items.map((t) => (
              <tr key={t._id} className="border-b border-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{t['Train No']}</td>
                <td className="px-3 py-2 text-gray-600">{t['Train Name'] || '—'}</td>
                <td className="px-3 py-2 text-gray-600">{t['FROM']} &rarr; {t['TO']}</td>
                <td className="px-3 py-2 text-gray-600">{t['Train Type'] || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
        <span>{total} train{total === 1 ? '' : 's'}{total > 0 ? ` · page ${page} of ${totalPages}` : ''}</span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
