import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLUMNS = [
  { key: 'displayName', label: 'Student' },
  { key: 'grade', label: 'Grade' },
  { key: 'totalPoints', label: 'Total' },
  { key: 'safeCount', label: 'Safe' },
  { key: 'kindCount', label: 'Kind' },
  { key: 'responsibleCount', label: 'Responsible' },
  { key: 'workCompletionCount', label: 'Work Completion' },
  { key: 'allBadgesCount', label: 'All Badges' },
  { key: 'onTaskCount', label: 'On Task' },
  { key: 'dailyChallengeCount', label: 'Daily Challenge' },
];

export default function StudentsTab() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('totalPoints');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    async function load() {
      setLoading(true);
      // One read of the full students collection. At ~1,400 documents this
      // is a single, occasional admin-only load — well within Spark's free
      // read quota, and far simpler than paginating for a table this size.
      const snap = await getDocs(collection(db, 'students'));
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  const rows = useMemo(() => {
    let out = students;
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      out = out.filter((s) => (s.displayName || '').toLowerCase().includes(term));
    }
    out = [...out].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return out;
  }, [students, search, sortKey, sortDir]);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="rounded-2xl bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-plum-100 p-4">
        <h3 className="font-display text-lg font-semibold text-plum-900">
          Student Points ({rows.length})
        </h3>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students…"
          className="input max-w-xs"
        />
      </div>

      {loading ? (
        <p className="p-8 text-center text-sm text-plum-700/50">Loading students…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-plum-100 text-left text-xs uppercase tracking-wide text-plum-500">
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => handleSort(c.key)}
                    className="cursor-pointer select-none whitespace-nowrap px-4 py-3 hover:text-plum-800"
                  >
                    {c.label} {sortKey === c.key && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-plum-50">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-plum-50/60">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-plum-900">
                    {s.displayName}
                  </td>
                  <td className="px-4 py-2.5 text-plum-700">{s.grade ?? '—'}</td>
                  <td className="px-4 py-2.5 font-semibold text-plum-900">{s.totalPoints ?? 0}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.safeCount ?? 0}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.kindCount ?? 0}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.responsibleCount ?? 0}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.workCompletionCount ?? 0}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.allBadgesCount ?? 0}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.onTaskCount ?? 0}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.dailyChallengeCount ?? 0}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-plum-700/50">
                    No students match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
