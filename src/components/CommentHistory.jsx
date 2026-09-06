import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getDateKeyDaysAgo } from '../lib/dateKey';

const CATEGORY_LABEL = { SAFE: 'Safe', KIND: 'Kind', RESPONSIBLE: 'Responsible' };
const CATEGORY_COLOR = { SAFE: 'bg-plum-500', KIND: 'bg-gold-400', RESPONSIBLE: 'bg-plum-700' };

/**
 * Shows the student's own comment history — only entries where a
 * teacher actually wrote something, only from the last 30 days.
 *
 * Bounded on purpose: this queries pointTransactions for just this one
 * student within a 30-day window (using the existing studentId+dateKey
 * composite index, so no new index needed), which tops out at a few
 * dozen documents even in the busiest classroom — nowhere near the cost
 * of, say, a school-wide query. Comments aren't stored anywhere except
 * on the ledger entry itself, so nothing new was added to the data
 * model for this feature beyond an optional `comment` + `teacherName`
 * field on award transactions that already existed.
 */
export default function CommentHistory({ studentId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const cutoff = getDateKeyDaysAgo(30);
        const snap = await getDocs(
          query(
            collection(db, 'pointTransactions'),
            where('studentId', '==', studentId),
            where('dateKey', '>=', cutoff)
          )
        );
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((t) => t.comment && CATEGORY_LABEL[t.category])
          .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        setComments(rows);
      } catch (e) {
        console.error('Failed to load comment history', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentId]);

  if (loading) {
    return <p className="py-6 text-center text-sm text-plum-700/50">Loading…</p>;
  }

  if (comments.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-card">
        <p className="text-plum-700">No comments from the last 30 days yet.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id} className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${CATEGORY_COLOR[c.category]}`}
            >
              {CATEGORY_LABEL[c.category]}
            </span>
            <span className="text-xs text-plum-700/50">
              {c.timestamp?.toDate?.().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
          <p className="mt-2 text-sm text-plum-900">{c.comment}</p>
          {c.teacherName && <p className="mt-1 text-xs text-plum-700/50">— {c.teacherName}</p>}
        </li>
      ))}
    </ul>
  );
}
