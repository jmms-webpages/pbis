import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';
import TeacherSidebar from '../components/TeacherSidebar';
import Leaderboard from '../components/Leaderboard';
import ClassRoster from '../components/ClassRoster';
import NewClassModal from '../components/NewClassModal';

export default function TeacherDashboard() {
  const { firebaseUser, profile } = useAuth();
  const [classes, setClasses] = useState([]);
  const [view, setView] = useState('dashboard'); // 'dashboard' | classId
  const [showNewClass, setShowNewClass] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'classes'), where('teacherId', '==', firebaseUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [firebaseUser.uid]);

  const activeClass = classes.find((c) => c.id === view);
  const teacherGrades = profile?.gradeLevels?.length ? profile.gradeLevels : [6, 7, 8];

  return (
    <AppShell title="PBIS Rewards — Teacher">
      <div className="-mx-4 -my-6 flex min-h-[calc(100vh-8.5rem)] sm:-mx-6">
        <TeacherSidebar
          classes={classes}
          view={view}
          onSelectDashboard={() => setView('dashboard')}
          onSelectClass={(id) => setView(id)}
          onNewClass={() => setShowNewClass(true)}
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {view === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-plum-900">Dashboard</h2>
                <p className="text-sm text-plum-700/60">
                  Leaderboards for {teacherGrades.map((g) => `${g}th`).join(', ')} grade
                  {teacherGrades.length > 1 ? 's' : ''} and school-wide.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {teacherGrades.map((g) => (
                  <Leaderboard key={g} grade={g} title={`${g}th Grade — Top 25`} />
                ))}
                <Leaderboard grade={null} title="School-wide — Top 25" />
              </div>
            </div>
          )}

          {activeClass && <ClassRoster classData={activeClass} teacherId={firebaseUser.uid} />}

          {view !== 'dashboard' && !activeClass && (
            <div className="rounded-2xl bg-white p-8 text-center shadow-card">
              <p className="text-plum-700">Select a class from the sidebar, or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      {showNewClass && (
        <NewClassModal
          teacherId={firebaseUser.uid}
          onClose={() => setShowNewClass(false)}
          onCreated={(id) => {
            setView(id);
            setShowNewClass(false);
          }}
        />
      )}
    </AppShell>
  );
}
