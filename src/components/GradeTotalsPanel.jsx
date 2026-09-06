import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const GRADES = [6, 7, 8];

/**
 * Shows one big number per grade — total combined points across every
 * student in that grade — meant to be projected/read aloud to spark
 * grade-vs-grade competition. Deliberately NOT shown anywhere in the
 * student-facing UI.
 *
 * Reads the whole `students` collection once per click (~1,400 docs at
 * full school size) and sums client-side by grade. This is simpler and
 * actually cheaper than three separate grade-filtered queries (same
 * total documents read, one round trip instead of three), and it needs
 * no composite index since it's a plain unfiltered collection read.
 * Manual refresh only — no live listener — since this isn't something
 * that needs to update in real time, just an on-demand snapshot for a
 * classroom moment.
 */
export default function GradeTotalsPanel() {
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'students'));
      const sums = { 6: 0, 7: 0, 8: 0 };
      snap.forEach((d) => {
        const grade = d.data().grade;
        if (sums[grade] !== undefined) {
          sums[grade] += d.data().totalPoints || 0;
        }
      });
      setTotals(sums);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error('Failed to load grade totals', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold text-plum-900">Grade Totals</h3>
          <p className="text-xs text-plum-700/50">
            {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-plum-200 px-3 py-1.5 text-sm font-medium text-plum-700 hover:bg-plum-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {GRADES.map((g) => (
          <div key={g} className="rounded-xl bg-plum-50 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-plum-500">{g}th Grade</p>
            <p className="mt-1 font-display text-3xl font-bold text-plum-800">
              {totals ? totals[g].toLocaleString() : '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
