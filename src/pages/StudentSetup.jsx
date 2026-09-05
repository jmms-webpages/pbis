import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const GRADES = [6, 7, 8];

export default function StudentSetup() {
  const { firebaseUser, refreshProfile, profile } = useAuth();
  const [grade, setGrade] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  if (profile?.setupComplete) {
    navigate('/', { replace: true });
    return null;
  }

  const handleContinue = async () => {
    if (!grade) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'students', firebaseUser.uid), { grade });
      await updateDoc(doc(db, 'users', firebaseUser.uid), { setupComplete: true });
      await refreshProfile();
      navigate('/', { replace: true });
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-plum-50 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
        <h1 className="font-display text-2xl font-semibold text-plum-900">Welcome!</h1>
        <p className="mt-1 text-sm text-plum-700/70">
          Let's get your account set up. What grade are you in?
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => setGrade(g)}
              className={`rounded-xl border-2 py-6 font-display text-2xl font-semibold transition ${
                grade === g
                  ? 'border-plum-600 bg-plum-600 text-white'
                  : 'border-plum-200 text-plum-800 hover:border-plum-400'
              }`}
            >
              {g}th
            </button>
          ))}
        </div>

        <button
          onClick={handleContinue}
          disabled={!grade || saving}
          className="mt-8 w-full rounded-xl bg-gold-400 py-3 font-medium text-plum-900 transition hover:bg-gold-300 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Continue to dashboard'}
        </button>
        <p className="mt-3 text-center text-xs text-plum-700/50">
          You won't need to do this again — an admin can update it later if needed.
        </p>
      </div>
    </div>
  );
}
