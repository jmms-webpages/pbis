import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';
import Leaderboard from '../components/Leaderboard';
import DailyChallenge from '../components/DailyChallenge';
import JoinClassModal from '../components/JoinClassModal';
import { getTodayDateKey } from '../lib/dateKey';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'challenge', label: 'Daily Challenge' },
  { id: 'leaderboards', label: 'Leaderboards' },
];

export default function StudentDashboard() {
  const { firebaseUser, profile } = useAuth();
  const [studentDoc, setStudentDoc] = useState(null);
  const [todayPoints, setTodayPoints] = useState(0);
  const [tab, setTab] = useState('overview');
  const [showJoinClass, setShowJoinClass] = useState(false);
  const dateKey = getTodayDateKey();

  useEffect(() => {
    // Live listener here is fine — it's a single document, not a fan-out
    // query, so the read cost stays flat regardless of school size.
    const unsub = onSnapshot(doc(db, 'students', firebaseUser.uid), (snap) => {
      setStudentDoc(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [firebaseUser.uid]);

  useEffect(() => {
    // Small, bounded query: at most 4 transactions/day/student
    // (Safe, Kind, Responsible, Daily Challenge), so this is cheap even
    // read fresh on every visit.
    async function loadToday() {
      const snap = await getDocs(
        query(
          collection(db, 'pointTransactions'),
          where('studentId', '==', firebaseUser.uid),
          where('dateKey', '==', dateKey)
        )
      );
      const sum = snap.docs.reduce((acc, d) => acc + (d.data().points || 0), 0);
      setTodayPoints(sum);
    }
    loadToday();
  }, [firebaseUser.uid, dateKey]);

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
            <div className="rounded-2xl bg-white p-4 shadow-card">
              <h3 className="mb-3 font-display text-base font-semibold text-plum-900">
                Your recognitions
              </h3>
              <div className="space-y-2 text-sm">
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
            <Leaderboard
              grade={studentDoc?.grade}
              title={studentDoc?.grade ? `${studentDoc.grade}th Grade — Top 25` : 'Your Grade — Top 25'}
              highlightUid={firebaseUser.uid}
            />
          </div>
        </div>
      )}

      {tab === 'challenge' && <DailyChallenge />}

      {tab === 'leaderboards' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Leaderboard grade={6} title="6th Grade — Top 25" highlightUid={firebaseUser.uid} />
          <Leaderboard grade={7} title="7th Grade — Top 25" highlightUid={firebaseUser.uid} />
          <Leaderboard grade={8} title="8th Grade — Top 25" highlightUid={firebaseUser.uid} />
          <Leaderboard grade={null} title="School-wide — Top 25" highlightUid={firebaseUser.uid} />
        </div>
      )}

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

