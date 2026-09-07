import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const GRADES = [6, 7, 8];

/**
 * Shows one big number per grade — total combined points across every
 * student in that grade — meant to be projected/read aloud to spark
 * grade-vs-grade competition.
 *
 * Blaze Plan Optimization:
 * Checks system/gradeTotals first (1 single document read).
 * If not present or manual forced recalculation, computes from students
 * and publishes back to system/gradeTotals so all other staff get 1-read access.
 */
export default function GradeTotalsPanel() {
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const refresh = async (force = false) => {
    const cacheKey = 'pbis_grade_totals';
    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - (parsed.time || 0) < 30 * 60 * 1000) {
            setTotals(parsed.sums);
            setLastRefreshed(new Date(parsed.time));
            return;
          }
        } catch {}
      }
    }

    setLoading(true);
    try {
      // 1. Try reading the aggregated single document (1 read on Blaze plan)
      if (!force) {
        try {
          const sysSnap = await getDoc(doc(db, 'system', 'gradeTotals'));
          if (sysSnap.exists() && sysSnap.data().sums) {
            const data = sysSnap.data();
            setTotals(data.sums);
            const stamp = data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date();
            setLastRefreshed(stamp);
            sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), sums: data.sums }));
            setLoading(false);
            return;
          }
        } catch (sysErr) {
          console.warn('Could not read system/gradeTotals aggregation doc, falling back', sysErr);
        }
      }

      // 2. Fallback: scan students collection and recalculate
      const snap = await getDocs(collection(db, 'students'));
      const sums = { 6: 0, 7: 0, 8: 0 };
      snap.forEach((d) => {
        const grade = d.data().grade;
        if (sums[grade] !== undefined) {
          sums[grade] += d.data().totalPoints || 0;
        }
      });
      setTotals(sums);
      const now = new Date();
      setLastRefreshed(now);
      sessionStorage.setItem(cacheKey, JSON.stringify({ time: now.getTime(), sums }));

      // Save to system/gradeTotals to optimize all future reads for other teachers
      try {
        await setDoc(doc(db, 'system', 'gradeTotals'), {
          sums,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (saveErr) {
        console.warn('Could not write back to system/gradeTotals', saveErr);
      }
    } catch (e) {
      console.error('Failed to load grade totals', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh(false);
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
          onClick={() => refresh(true)}
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
