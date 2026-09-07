import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getDateKeyDaysAgo } from '../lib/dateKey';

const CATEGORY_LABEL = {
  SAFE: 'Safe',
  KIND: 'Kind',
  RESPONSIBLE: 'Responsible',
  WORK_COMPLETION: 'Work Completion',
  ALL_BADGES: 'All Badges',
  ON_TASK: 'On Task',
  DAILY_CHALLENGE: 'Daily Challenge',
  ADMIN_ADJUSTMENT: 'Adjustment',
};

const CATEGORY_COLOR = {
  SAFE: 'bg-plum-500 text-white',
  KIND: 'bg-gold-500 text-plum-950',
  RESPONSIBLE: 'bg-plum-700 text-white',
  WORK_COMPLETION: 'bg-emerald-600 text-white',
  ALL_BADGES: 'bg-purple-600 text-white',
  ON_TASK: 'bg-blue-600 text-white',
  DAILY_CHALLENGE: 'bg-amber-600 text-white',
  ADMIN_ADJUSTMENT: 'bg-plum-800 text-white',
};

/**
 * Shows the student's own comment history — entries where a teacher
 * wrote a comment or an administrator made an adjustment with a reason,
 * within the last 30 days.
 *
 * Resilient Query: Queries by `where('studentId', '==', studentId)` alone.
 * This guarantees zero reliance on manual Firestore composite index creation
 * (which causes failed-precondition errors when combining == and >= on different fields).
 * The 30-day cutoff and comment/reason filters are evaluated cleanly in JavaScript.
 */
export default function CommentHistory({ studentId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async (force = false) => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const cacheKey = `pbis_comments_${studentId}`;
    if (!force) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // 15-minute freshness window
          if (Date.now() - (parsed.time || 0) < 15 * 60 * 1000) {
            setComments(parsed.rows || []);
            setLoading(false);
            return;
          }
        } catch {}
      }
    }
    try {
      const cutoff = getDateKeyDaysAgo(30);
      // Query single-field equality only to avoid composite index requirements
      const snap = await getDocs(
        query(
          collection(db, 'pointTransactions'),
          where('studentId', '==', studentId)
        )
      );

      const rows = snap.docs
        .map((d) => {
          const data = d.data();
          let formattedDate = '';
          if (data.timestamp?.toDate) {
            formattedDate = data.timestamp.toDate().toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
          } else if (data.dateKey) {
            const [y, m, day] = data.dateKey.split('-').map(Number);
            formattedDate = new Date(y, m - 1, day).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
          }
          const timestampMillis =
            data.timestamp?.toMillis?.() ||
            (data.dateKey ? new Date(data.dateKey + 'T12:00:00').getTime() : 0);

          const displayText =
            (typeof data.comment === 'string' && data.comment.trim()) ||
            (typeof data.reason === 'string' && data.reason.trim()) ||
            '';

          return {
            id: d.id,
            ...data,
            displayText,
            formattedDate,
            timestampMillis,
          };
        })
        .filter((t) => {
          if (!t.displayText) {
            return false;
          }
          // Filter within 30 days if dateKey is present
          if (cutoff && t.dateKey && t.dateKey < cutoff) {
            return false;
          }
          return true;
        })
        .sort((a, b) => b.timestampMillis - a.timestampMillis);

      setComments(rows);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), rows }));
      } catch {}
    } catch (e) {
      console.error('Failed to load comment history', e);
      setError(e.message || 'Failed to load comments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (loading) {
    return <p className="py-6 text-center text-sm text-plum-700/50">Loading…</p>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn't load comments: {error}
        </p>
        <button onClick={() => load(true)} className="text-xs font-medium text-plum-600 underline">
          Retry
        </button>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-card">
        <p className="text-plum-700">No comments or adjustments from the last 30 days yet.</p>
        <button
          onClick={() => load(true)}
          className="mt-3 text-xs font-medium text-plum-600 hover:text-plum-800 underline"
        >
          Check for new comments
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => load(true)}
          className="text-xs font-medium text-plum-600 hover:text-plum-800"
        >
          Refresh comments
        </button>
      </div>
      <ul className="space-y-3">
        {comments.map((c) => {
          const isAdminAdjustment = c.source === 'ADMIN' || c.category === 'ADMIN_ADJUSTMENT';
          const pointsDelta = typeof c.points === 'number' ? c.points : null;
          const authorText =
            c.teacherName ||
            c.adminName ||
            (isAdminAdjustment ? 'Administrator' : null);

          return (
            <li key={c.id} className="rounded-2xl bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isAdminAdjustment
                        ? 'bg-plum-800 text-white'
                        : CATEGORY_COLOR[c.category] || 'bg-plum-600 text-white'
                    }`}
                  >
                    {isAdminAdjustment
                      ? `Adjustment (${CATEGORY_LABEL[c.category] || 'General'})`
                      : CATEGORY_LABEL[c.category] || c.category || 'Award'}
                  </span>
                  {c.formattedDate && (
                    <span className="text-xs text-plum-700/50">
                      {c.formattedDate}
                    </span>
                  )}
                </div>
                {pointsDelta !== null && (
                  <span
                    className={`text-xs font-bold ${
                      pointsDelta >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {pointsDelta > 0 ? `+${pointsDelta}` : pointsDelta} pts
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-plum-900">{c.displayText}</p>
              {authorText && (
                <p className="mt-1 text-xs text-plum-700/50">— {authorText}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
