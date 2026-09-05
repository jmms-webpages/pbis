import { useState } from 'react';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function JoinClassModal({ onClose, onJoined }) {
  const { firebaseUser } = useAuth();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState(null); // {type:'error'|'success', text}
  const [busy, setBusy] = useState(false);

  const handleJoin = async () => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setBusy(true);
    setStatus(null);
    try {
      // The index doc is the only thing a student needs read access to —
      // it resolves a code to a classId without ever exposing the full
      // class roster or requiring read access to the class document
      // itself (which stays teacher/admin-only).
      const indexSnap = await getDoc(doc(db, 'classCodeIndex', clean));
      if (!indexSnap.exists() || !indexSnap.data().active) {
        setStatus({ type: 'error', text: 'That code is invalid or no longer active. Double-check with your teacher.' });
        return;
      }
      const { classId, className, period } = indexSnap.data();
      // Blind write — no read of the class doc needed. Firestore rules
      // independently verify this is a real, unlocked class and that the
      // update only ever adds the caller's own uid to studentIds.
      await updateDoc(doc(db, 'classes', classId), {
        studentIds: arrayUnion(firebaseUser.uid),
      });
      setStatus({ type: 'success', text: `Joined ${className} (Period ${period})!` });
      setTimeout(() => onJoined?.(), 1200);
    } catch (e) {
      console.error(e);
      setStatus({
        type: 'error',
        text: 'Could not join — you may already be in this class, or it may be locked.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-plum-900/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-display text-lg font-semibold text-plum-900">Join a class</h3>
        <p className="mt-1 text-sm text-plum-700/60">Enter the code your teacher shared with you.</p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          placeholder="e.g. K7XQPL"
          className="input mt-4 text-center font-mono text-lg tracking-widest"
          maxLength={8}
        />
        {status && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}
          >
            {status.text}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-plum-200 py-2.5 text-sm font-medium text-plum-700">
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={busy || !code.trim()}
            className="flex-1 rounded-xl bg-plum-700 py-2.5 text-sm font-medium text-white hover:bg-plum-800 disabled:opacity-50"
          >
            {busy ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  );
}
