import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Pulls top 25 by totalPoints for a given grade (or school-wide if
 * grade is null). Uses a one-shot getDocs() rather than a live
 * onSnapshot() listener — with ~1,400 students, a live listener on every
 * open dashboard would multiply reads fast and isn't worth it against the
 * Spark plan's free quota. A manual refresh button covers the rare case
 * someone wants up-to-the-second standings.
 */
export default function Leaderboard({ grade, title, highlightUid }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const base = collection(db, 'students');
      const q = grade
        ? query(base, where('grade', '==', grade), orderBy('totalPoints', 'desc'), limit(25))
        : query(base, orderBy('totalPoints', 'desc'), limit(25));
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Leaderboard load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade]);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-plum-900">{title}</h3>
        <button onClick={load} className="text-xs text-plum-600 hover:text-plum-800">
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="py-6 text-center text-sm text-plum-700/50">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-plum-700/50">No points yet — be the first!</p>
      ) : (
        <ol className="divide-y divide-plum-100">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className={`flex items-center gap-3 py-2 ${
                r.id === highlightUid ? 'rounded-lg bg-gold-50 px-2' : ''
              }`}
            >
              <span
                className={`w-6 text-center font-display text-sm font-semibold ${
                  i < 3 ? 'text-gold-500' : 'text-plum-400'
                }`}
              >
                {i + 1}
              </span>
              <span className="flex-1 truncate text-sm text-plum-900">{r.displayName}</span>
              <span className="font-display text-sm font-semibold text-plum-700">
                {r.totalPoints ?? 0}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
