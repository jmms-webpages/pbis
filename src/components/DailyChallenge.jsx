import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getTodayDateKey, formatDateKeyForDisplay } from '../lib/dateKey';
import { submitDailyChallengeAnswer } from '../lib/pbis';
import { useAuth } from '../context/AuthContext';

export default function DailyChallenge({ studentDoc }) {
  const { firebaseUser } = useAuth();
  const dateKey = getTodayDateKey();
  const [status, setStatus] = useState('loading'); // loading | done | active | empty
  const [current, setCurrent] = useState(null);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null); // 'wrong' | null
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const doneKey = `pbis_challenge_done_${firebaseUser.uid}_${dateKey}`;

      // 1. Check persistent browser storage (0 Firestore reads)
      if (localStorage.getItem(doneKey) === 'true' || sessionStorage.getItem(doneKey) === 'true') {
        setStatus('done');
        return;
      }

      // 2. Check studentDoc already in memory from AppShell listener (0 Firestore reads)
      if (
        studentDoc?.lastDailyChallengeDate === dateKey ||
        (studentDoc?.lastAwardCategory === 'DAILY_CHALLENGE' && studentDoc?.lastAwardDateKey === dateKey)
      ) {
        localStorage.setItem(doneKey, 'true');
        setStatus('done');
        return;
      }

      // 3. Fallback: Check guard doc only if storage is unpopulated (1 read max)
      try {
        const guardSnap = await getDoc(
          doc(db, 'dailyAwards', `${firebaseUser.uid}_${dateKey}_DAILY_CHALLENGE`)
        );
        if (guardSnap.exists()) {
          localStorage.setItem(doneKey, 'true');
          setStatus('done');
          return;
        }
      } catch (err) {
        console.warn('Guard check error:', err);
      }

      // 4. Fetch Question of the Day with local caching
      const questionCacheKey = `pbis_daily_q_${dateKey}`;
      const cachedQ = localStorage.getItem(questionCacheKey);
      if (cachedQ) {
        try {
          const parsed = JSON.parse(cachedQ);
          if (parsed && parsed.questionText && parsed.choices) {
            setCurrent(parsed);
            setStatus('active');
            return;
          }
        } catch {
          // invalid cache, continue
        }
      }

      // Attempt 1: Fetch single dedicated Question of the Day document (1 single read)
      try {
        const dailyDocRef = doc(db, 'dailyChallengeQuestions', `daily_${dateKey}`);
        const dailyDocSnap = await getDoc(dailyDocRef);
        if (dailyDocSnap.exists()) {
          const d = dailyDocSnap.data();
          const qObj = {
            id: d.questionId || dailyDocSnap.id,
            questionText: d.questionText,
            choices: d.choices,
            category: d.category || null,
          };
          setCurrent(qObj);
          localStorage.setItem(questionCacheKey, JSON.stringify(qObj));
          setStatus('active');
          return;
        }
      } catch (err) {
        console.warn('Could not read scheduled daily question doc:', err);
      }

      // Attempt 2: Fetch 'today' alias document (1 single read)
      try {
        const todayDocRef = doc(db, 'dailyChallengeQuestions', 'today');
        const todayDocSnap = await getDoc(todayDocRef);
        if (todayDocSnap.exists()) {
          const d = todayDocSnap.data();
          const qObj = {
            id: d.questionId || todayDocSnap.id,
            questionText: d.questionText,
            choices: d.choices,
            category: d.category || null,
          };
          setCurrent(qObj);
          localStorage.setItem(questionCacheKey, JSON.stringify(qObj));
          setStatus('active');
          return;
        }
      } catch (err) {
        console.warn('Could not read today alias doc:', err);
      }

      // Fallback: Read active question pool once, pick deterministic daily question,
      // and cache in localStorage for the day so subsequent loads require 0 reads.
      try {
        const qSnap = await getDocs(
          query(collection(db, 'dailyChallengeQuestions'), where('active', '==', true))
        );
        const validQuestions = qSnap.docs
          .filter((d) => !d.id.startsWith('daily_') && d.id !== 'today')
          .map((d) => ({ id: d.id, ...d.data() }));

        if (validQuestions.length === 0) {
          setStatus('empty');
          return;
        }

        // Deterministic hash so all students get the exact same Question of the Day
        const hash = dateKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const dailyQuestion = validQuestions[hash % validQuestions.length];
        setCurrent(dailyQuestion);
        localStorage.setItem(questionCacheKey, JSON.stringify(dailyQuestion));
        setStatus('active');
      } catch (poolErr) {
        console.error('Failed to load daily questions', poolErr);
        setStatus('empty');
      }
    }

    load();
  }, [firebaseUser.uid, dateKey, studentDoc?.lastDailyChallengeDate, studentDoc?.lastAwardCategory, studentDoc?.lastAwardDateKey]);

  const handleSubmit = async () => {
    if (selected === null || !current) return;
    setSubmitting(true);
    setFeedback(null);
    const doneKey = `pbis_challenge_done_${firebaseUser.uid}_${dateKey}`;
    try {
      const result = await submitDailyChallengeAnswer({
        studentId: firebaseUser.uid,
        questionId: current.id,
        selectedAnswer: selected,
      });
      if (result.correct) {
        localStorage.setItem(doneKey, 'true');
        sessionStorage.setItem(doneKey, 'true');
        setStatus('done');
      } else {
        setFeedback('wrong');
      }
    } catch (e) {
      if (e.message === 'ALREADY_COMPLETED_TODAY') {
        localStorage.setItem(doneKey, 'true');
        sessionStorage.setItem(doneKey, 'true');
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
          Not quite — rethink your answer and try another choice!
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
