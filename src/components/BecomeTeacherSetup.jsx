import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const GRADES = [6, 7, 8];

// Distinct from TeacherSetup: this never touches users/{uid}.role (the
// admin stays an admin) — it just creates the teachers/{uid} profile doc
// that Teacher View reads from, the same way a real teacher's setup does.
export default function BecomeTeacherSetup({ onDone }) {
  const { firebaseUser } = useAuth();
  const [gradeLevels, setGradeLevels] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = (g) => {
    setGradeLevels((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const handleContinue = async () => {
    if (gradeLevels.length === 0) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'teachers', firebaseUser.uid), {
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        gradeLevels,
        createdAt: serverTimestamp(),
      });
      onDone();
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-card">
        <h1 className="font-display text-2xl font-semibold text-plum-900">Set up your classes</h1>
        <p className="mt-1 text-sm text-plum-700/70">
          Which grade levels do you teach? You'll keep your admin access — this just lets you also
          create classes and award points like any teacher.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => toggle(g)}
              className={`rounded-xl border-2 py-6 font-display text-2xl font-semibold transition ${
                gradeLevels.includes(g)
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
          disabled={gradeLevels.length === 0 || saving}
          className="mt-8 w-full rounded-xl bg-gold-400 py-3 font-medium text-plum-900 transition hover:bg-gold-300 disabled:opacity-50"
        >
          {saving ? 'Setting up…' : 'Continue to Teacher View'}
        </button>
      </div>
    </div>
  );
}
