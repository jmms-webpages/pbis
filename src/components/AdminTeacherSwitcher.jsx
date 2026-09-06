import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import AdminDashboard from '../pages/AdminDashboard';
import TeacherDashboard from '../pages/TeacherDashboard';
import BecomeTeacherSetup from './BecomeTeacherSetup';

export default function AdminTeacherSwitcher() {
  const { firebaseUser } = useAuth();
  const [viewMode, setViewMode] = useState('admin'); // 'admin' | 'teacher'
  const [hasTeacherProfile, setHasTeacherProfile] = useState(null); // null = loading

  useEffect(() => {
    getDoc(doc(db, 'teachers', firebaseUser.uid)).then((snap) => {
      setHasTeacherProfile(snap.exists());
    });
  }, [firebaseUser.uid]);

  return (
    <div>
      {/* Slim always-visible switch bar sits above whichever dashboard is
          showing — an admin's own role never changes, this only decides
          which view renders. */}
      <div className="flex items-center justify-center gap-1 bg-plum-900 py-1.5">
        <button
          onClick={() => setViewMode('admin')}
          className={`rounded-full px-4 py-1 text-xs font-medium transition ${
            viewMode === 'admin' ? 'bg-gold-400 text-plum-900' : 'text-plum-300 hover:text-white'
          }`}
        >
          Admin View
        </button>
        <button
          onClick={() => setViewMode('teacher')}
          className={`rounded-full px-4 py-1 text-xs font-medium transition ${
            viewMode === 'teacher' ? 'bg-gold-400 text-plum-900' : 'text-plum-300 hover:text-white'
          }`}
        >
          Teacher View
        </button>
      </div>

      {viewMode === 'admin' && <AdminDashboard />}
      {viewMode === 'teacher' && hasTeacherProfile === false && (
        <BecomeTeacherSetup onDone={() => setHasTeacherProfile(true)} />
      )}
      {viewMode === 'teacher' && hasTeacherProfile && <TeacherDashboard />}
    </div>
  );
}
