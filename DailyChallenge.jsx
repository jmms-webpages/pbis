import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getTodayDateKey, formatDateKeyForDisplay } from '../lib/dateKey';
import { submitDailyChallengeAnswer } from '../lib/pbis';
import { useAuth } from '../context/AuthContext';

export default function DailyChallenge() {
  const { firebaseUser } = useAuth();
  const dateKey = getTodayDateKey();
  const [status, setStatus] = useState('loading'); // loading | done | active
  const [pool, setPool] = useState([]);
  const [seenIds, setSeenIds] = useState([]);
  const [current, setCurrent] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'wrong' | null
  const [submitting, setSubmitting] = useState(false);

  const pickNext = useCallback(
    (poolArg, seenArg) => {
      const remaining = poolArg.filter((q) => !seenArg.includes(q.id));
      const source = remaining.length > 0 ? remaining : poolArg; // cycle back if pool exhausted
      const next = source[Math.floor(Math.random() * source.length)];
      setCurrent(next || null);
      setSelected(null);
    },
    []
  );

  useEffect(() => {
    async function load() {
      const guardSnap = await getDoc(
        doc(db, 'dailyAwards', `${firebaseUser.uid}_${dateKey}_DAILY_CHALLENGE`)
      );
      if (guardSnap.exists()) {
        setStatus('done');
        return;
      }
      const qSnap = await getDocs(
        query(collection(db, 'dailyChallengeQuestions'), where('active', '==', true))
      );
      const questions = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPool(questions);
      if (questions.length === 0) {
        setStatus('empty');
        return;
      }
      pickNext(questions, []);
      setStatus('active');
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser.uid, dateKey]);

  const handleSubmit = async () => {
    if (selected === null || !current) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await submitDailyChallengeAnswer({
        studentId: firebaseUser.uid,
        questionId: current.id,
        selectedAnswer: selected,
      });
      if (result.correct) {
        setStatus('done');
      } else {
        const nextSeen = [...seenIds, current.id];
        setSeenIds(nextSeen);
        setFeedback('wrong');
        pickNext(pool, nextSeen);
      }
    } catch (e) {
      if (e.message === 'ALREADY_COMPLETED_TODAY') {
        setStatus('done');
      } else {
        console.error(e);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <p className="text-sm text-plum-700/60">Loading today's challenge…</p>;
  }

  if (status === 'empty') {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-card">
        <p className="text-plum-700">No challenge questions are available right now. Check back soon!</p>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="rounded-2xl bg-gold-50 p-6 text-center shadow-card">
        <p className="font-display text-lg font-semibold text-plum-900">
          You already earned today's 10 points! 🎉
        </p>
        <p className="mt-1 text-sm text-plum-700/70">{formatDateKeyForDisplay(dateKey)}</p>
        <p className="mt-3 text-sm text-plum-700/60">Come back tomorrow for a new challenge.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-plum-500">
          Worth 10 points
        </p>
        <p className="text-xs text-plum-700/50">{formatDateKeyForDisplay(dateKey)}</p>
      </div>

      <p className="font-display text-lg font-semibold text-plum-900">{current?.questionText}</p>

      <div className="mt-4 space-y-2">
        {current?.choices?.map((choice, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
              selected === i
                ? 'border-plum-600 bg-plum-50 text-plum-900'
                : 'border-plum-100 text-plum-800 hover:border-plum-300'
            }`}
          >
            {choice}
          </button>
        ))}
      </div>

      {feedback === 'wrong' && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Not quite — here's another question.
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={selected === null || submitting}
        className="mt-5 w-full rounded-xl bg-plum-700 py-3 font-medium text-white transition hover:bg-plum-800 disabled:opacity-50"
      >
        {submitting ? 'Checking…' : 'Submit answer'}
      </button>
    </div>
  );
}
