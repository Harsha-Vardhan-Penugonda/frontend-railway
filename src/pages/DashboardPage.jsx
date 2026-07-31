import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Plus, Play, Pause, ChevronLeft, ChevronRight, ArrowUpDown,
  Database, Clock, CheckCircle2, Archive as ArchiveIcon, HardDrive,
} from 'lucide-react';
import { baseUrl } from '../apiBase';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useDebounced } from '../hooks/useDebounced';
import { StatTile } from '../components/dashboard/StatTile';
import { StatusBadge, CategoryBadge } from '../components/dashboard/Badge';
import { RequestKeyModal } from '../components/dashboard/RequestKeyModal';
import { ClipDetailModal } from '../components/dashboard/ClipDetailModal';
import { formatDuration, formatBytes, timeAgo } from '../utils/format';

const CATEGORIES = ['Station Name', 'Train Name', 'Train Type', 'Digit', 'Phrase', 'Uncategorized'];
const STATUSES = ['pending', 'recorded', 'archived'];
const SORT_OPTIONS = [
  { value: 'requestedAt', label: 'Requested date' },
  { value: 'updatedAt', label: 'Last updated' },
  { value: 'key', label: 'Key (A-Z)' },
  { value: 'durationSeconds', label: 'Duration' },
  { value: 'fileSizeBytes', label: 'File size' },
];

export default function DashboardPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 300);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('requestedAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const limit = 15;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [detailKey, setDetailKey] = useState(null);

  const { playingKey, toggle } = useAudioPlayer();
  const reqIdRef = useRef(0);

  const fetchClips = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        search: debouncedSearch, status, category, sort, order,
        page: String(page), limit: String(limit),
      });
      const res = await fetch(`${baseUrl}/api/audio-clips?${params}`);
      if (!res.ok) throw new Error(`Failed to load clips (${res.status})`);
      const data = await res.json();
      if (reqId !== reqIdRef.current) return; // stale response, ignore
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      if (reqId === reqIdRef.current) setError(err.message);
    } finally {
      if (reqId === reqIdRef.current) setIsLoading(false);
    }
  }, [debouncedSearch, status, category, sort, order, page]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/audio-clips/summary`);
      if (res.ok) setSummary(await res.json());
    } catch {
      // stat tiles are non-critical; fail silently
    }
  }, []);

  useEffect(() => { fetchClips(); }, [fetchClips]);
  useEffect(() => { fetchSummary(); }, [fetchSummary, items]);

  // Reset to page 1 whenever a filter changes underneath the current page
  useEffect(() => { setPage(1); }, [debouncedSearch, status, category, sort, order]);

  const handleSortClick = (field) => {
    if (sort === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field);
      setOrder('desc');
    }
  };

  const columns = useMemo(() => ([
    { key: 'key', label: 'Key', sortable: true },
    { key: 'category', label: 'Category', sortable: false, hideOnMobile: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'durationSeconds', label: 'Duration', sortable: true, hideOnMobile: true },
    { key: 'fileSizeBytes', label: 'Size', sortable: true, hideOnMobile: true },
    { key: 'updatedAt', label: 'Updated', sortable: true, hideOnMobile: true },
  ]), []);

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audio Management Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">Every recorded, pending, and archived announcement clip in one place.</p>
          </div>
          <button
            onClick={() => setRequestModalOpen(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 shrink-0"
          >
            <Plus size={16} /> Request Recording
          </button>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Total clips" value={summary?.total ?? '—'} icon={Database} />
          <StatTile label="Recorded" value={summary?.recorded ?? '—'} icon={CheckCircle2} tone="emerald" />
          <StatTile label="Pending" value={summary?.pending ?? '—'} icon={Clock} tone="amber" />
          <StatTile label="Archived" value={summary?.archived ?? '—'} icon={ArchiveIcon} tone="gray" />
        </div>

        {/* Toolbar */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by key..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Search audio clips by key"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {error && <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-100">{error}</div>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-2 py-3 w-10"></th>
                  {columns.map((col) => (
                    <th key={col.key} className={`px-3 py-3 font-medium ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}>
                      {col.sortable ? (
                        <button
                          onClick={() => handleSortClick(col.key)}
                          className="inline-flex items-center gap-1 hover:text-gray-700"
                        >
                          {col.label}
                          <ArrowUpDown size={12} className={sort === col.key ? 'text-blue-600' : 'text-gray-300'} />
                        </button>
                      ) : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No audio clips match these filters.</td></tr>
                ) : items.map((clip) => (
                  <tr
                    key={clip._id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setDetailKey(clip.key)}
                  >
                    <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {clip.status !== 'pending' && (
                        <button
                          onClick={() => toggle(clip.key, `${baseUrl}/api/audio-clips/${encodeURIComponent(clip.key)}/audio`)}
                          className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700"
                          aria-label={playingKey === clip.key ? `Pause ${clip.key}` : `Play ${clip.key}`}
                        >
                          {playingKey === clip.key ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{clip.key}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell"><CategoryBadge category={clip.category} /></td>
                    <td className="px-3 py-2.5"><StatusBadge status={clip.status} /></td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-gray-500">{formatDuration(clip.durationSeconds)}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-gray-500">{formatBytes(clip.fileSizeBytes)}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-gray-500">{timeAgo(clip.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>{total} total{total > 0 ? ` · page ${page} of ${totalPages}` : ''}</span>
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

        <p className="flex items-center gap-1.5 text-xs text-gray-400">
          <HardDrive size={12} /> {formatBytes(summary?.totalBytes)} of audio stored in MongoDB
        </p>
      </div>

      <RequestKeyModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onCreated={() => { fetchClips(); fetchSummary(); }}
      />

      {detailKey && (
        <ClipDetailModal
          clipKey={detailKey}
          onClose={() => setDetailKey(null)}
          onChanged={() => { fetchClips(); fetchSummary(); }}
        />
      )}
    </div>
  );
}
