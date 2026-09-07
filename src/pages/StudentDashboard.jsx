import { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';
import DailyChallenge from '../components/DailyChallenge';
import JoinClassModal from '../components/JoinClassModal';
import CommentHistory from '../components/CommentHistory';
import { getTodayDateKey } from '../lib/dateKey';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'challenge', label: 'Daily Challenge' },
  { id: 'comments', label: 'Comments' },
];

export default function StudentDashboard() {
  const { firebaseUser, profile } = useAuth();
  const [studentDoc, setStudentDoc] = useState(null);
  const [todayPoints, setTodayPoints] = useState(0);
  const [tab, setTab] = useState('overview');
  const [showJoinClass, setShowJoinClass] = useState(false);
  const prevPointsRef = useRef(null);
  const dateKey = getTodayDateKey();

  useEffect(() => {
    // Single document live listener
    const unsub = onSnapshot(doc(db, 'students', firebaseUser.uid), (snap) => {
      setStudentDoc(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [firebaseUser.uid]);

  useEffect(() => {
    const cacheKey = `pbis_today_pts_${firebaseUser.uid}_${dateKey}`;
    const currentPoints = studentDoc?.totalPoints;

    async function loadToday(force = false) {
      if (!force) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached !== null) {
          setTodayPoints(Number(cached));
          return;
        }
      }
      try {
        const snap = await getDocs(
          query(
            collection(db, 'pointTransactions'),
            where('studentId', '==', firebaseUser.uid),
            where('dateKey', '==', dateKey)
          )
        );
        const sum = snap.docs.reduce((acc, d) => acc + (d.data().points || 0), 0);
        setTodayPoints(sum);
        sessionStorage.setItem(cacheKey, String(sum));
      } catch (e) {
        console.error('Failed to load today points', e);
      }
    }

    // Refresh if points changed or on initial load
    if (prevPointsRef.current !== null && prevPointsRef.current !== currentPoints) {
      loadToday(true);
    } else {
      loadToday(false);
    }
    prevPointsRef.current = currentPoints;
  }, [firebaseUser.uid, dateKey, studentDoc?.totalPoints]);

  return (
    <AppShell title="PBIS Rewards" tabs={TABS} activeTab={tab} onTabChange={setTab}>
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-plum-700/60">Welcome back!</p>
            <button
              onClick={() => setShowJoinClass(true)}
              className="rounded-lg border border-plum-200 bg-white px-3 py-1.5 text-sm font-medium text-plum-700 hover:bg-plum-50"
            >
              + Join a class
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Name" value={profile?.displayName} small />
            <StatCard label="Grade" value={studentDoc?.grade ? `${studentDoc.grade}th` : '—'} />
            <StatCard label="Total points" value={studentDoc?.totalPoints ?? 0} accent />
            <StatCard label="Today's points" value={todayPoints} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-3 font-display text-base font-semibold text-plum-900">
                Your Recognitions
              </h3>
              <div className="space-y-2.5 text-sm">
                <Row label="Safe" value={studentDoc?.safeCount ?? 0} color="bg-plum-500" />
                <Row label="Kind" value={studentDoc?.kindCount ?? 0} color="bg-gold-400" />
                <Row label="Responsible" value={studentDoc?.responsibleCount ?? 0} color="bg-plum-700" />
                <Row label="Work Completion" value={studentDoc?.workCompletionCount ?? 0} color="bg-plum-400" />
                <Row label="All Badges" value={studentDoc?.allBadgesCount ?? 0} color="bg-gold-500" />
                <Row label="On Task" value={studentDoc?.onTaskCount ?? 0} color="bg-plum-600" />
                <Row
                  label="Daily Challenge wins"
                  value={studentDoc?.dailyChallengeCount ?? 0}
                  color="bg-plum-300"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-3 font-display text-base font-semibold text-plum-900">
                School Expectations
              </h3>
              <div className="space-y-3 text-xs text-plum-700/80">
                <div className="rounded-xl bg-plum-50/60 p-3">
                  <p className="font-semibold text-plum-900">Be Safe (5 pts)</p>
                  <p className="mt-0.5">Keep hands and items to yourself, walk in hallways, follow classroom rules.</p>
                </div>
                <div className="rounded-xl bg-gold-50/70 p-3">
                  <p className="font-semibold text-plum-900">Be Kind (5 pts)</p>
                  <p className="mt-0.5">Use encouraging words, help classmates, and treat staff with dignity.</p>
                </div>
                <div className="rounded-xl bg-plum-50/60 p-3">
                  <p className="font-semibold text-plum-900">Be Responsible (5 pts)</p>
                  <p className="mt-0.5">Arrive prepared, stay organized, and take accountability for your choices.</p>
                </div>
                <div className="rounded-xl bg-plum-50/40 p-3">
                  <p className="font-semibold text-plum-900">Work & Focus (5 pts each)</p>
                  <p className="mt-0.5">Engage actively during class time and complete assigned tasks with pride.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'challenge' && <DailyChallenge studentDoc={studentDoc} />}

      {tab === 'comments' && <CommentHistory studentId={firebaseUser.uid} />}

      {showJoinClass && (
        <JoinClassModal onClose={() => setShowJoinClass(false)} onJoined={() => setShowJoinClass(false)} />
      )}
    </AppShell>
  );
}

function StatCard({ label, value, accent, small }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <p className="text-xs font-medium text-plum-500">{label}</p>
      <p
        className={`mt-1 font-display font-semibold ${
          accent ? 'text-3xl text-plum-700' : small ? 'truncate text-base text-plum-900' : 'text-2xl text-plum-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="flex-1 text-plum-800">{label}</span>
      <span className="font-semibold text-plum-900">{value}</span>
    </div>
  );
}

