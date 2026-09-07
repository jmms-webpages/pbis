import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  arrayRemove,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// Firestore batches cap at 500 operations; chunk well under that so a
// batch never gets close to the limit even with several collections'
// worth of deletes combined.
const BATCH_CHUNK_SIZE = 400;

export default function DangerZoneTab() {
  const [uidInput, setUidInput] = useState('');
  const [searchName, setSearchName] = useState('');
  const [allStudents, setAllStudents] = useState([]);
  const [preview, setPreview] = useState(null); // null | 'loading' | {...}
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getDocs(collection(db, 'students')).then((snap) =>
      setAllStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, []);

  const nameMatches =
    searchName.trim().length >= 2
      ? allStudents.filter((s) => (s.displayName || '').toLowerCase().includes(searchName.toLowerCase()))
      : [];

  const loadPreview = async (uid) => {
    setResult(null);
    setConfirmText('');
    setPreview('loading');
    try {
      const [userSnap, studentSnap, txSnap, awardSnap, attemptSnap, logSnap, classSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getDoc(doc(db, 'students', uid)),
        getDocs(query(collection(db, 'pointTransactions'), where('studentId', '==', uid))),
        getDocs(query(collection(db, 'dailyAwards'), where('studentId', '==', uid))),
        getDocs(query(collection(db, 'dailyChallengeAttempts'), where('studentId', '==', uid))),
        getDocs(query(collection(db, 'dailyChallengeLog'), where('studentId', '==', uid))),
        getDocs(query(collection(db, 'classes'), where('studentIds', 'array-contains', uid))),
      ]);

      if (!userSnap.exists() && !studentSnap.exists()) {
        setPreview({ notFound: true, uid });
        return;
      }

      setPreview({
        uid,
        userExists: userSnap.exists(),
        studentExists: studentSnap.exists(),
        displayName: studentSnap.data()?.displayName || userSnap.data()?.displayName || '(no name on file)',
        email: studentSnap.data()?.email || userSnap.data()?.email || '—',
        totalPoints: studentSnap.data()?.totalPoints ?? 0,
        txCount: txSnap.size,
        awardCount: awardSnap.size,
        attemptCount: attemptSnap.size,
        logCount: logSnap.size,
        classes: classSnap.docs.map((d) => ({ id: d.id, className: d.data().className })),
        // Keep the doc refs around so the wipe doesn't have to re-query.
        _refs: {
          tx: txSnap.docs.map((d) => d.ref),
          awards: awardSnap.docs.map((d) => d.ref),
          attempts: attemptSnap.docs.map((d) => d.ref),
          logs: logSnap.docs.map((d) => d.ref),
          classes: classSnap.docs.map((d) => d.ref),
        },
      });
    } catch (e) {
      console.error(e);
      setPreview({ error: e.message });
    }
  };

  const handleWipe = async () => {
    if (!preview || preview.notFound || preview.error) return;
    setBusy(true);
    try {
      const { uid, _refs } = preview;

      // Class membership removal first — a simple field update per class,
      // not a batch, since arrayRemove needs no read/precondition here.
      for (const classRef of _refs.classes) {
        await updateDoc(classRef, { studentIds: arrayRemove(uid) });
      }

      // Everything else, chunked into batches under Firestore's 500-op cap.
      const allDeletable = [..._refs.tx, ..._refs.awards, ..._refs.attempts, ..._refs.logs];
      for (let i = 0; i < allDeletable.length; i += BATCH_CHUNK_SIZE) {
        const batch = writeBatch(db);
        allDeletable.slice(i, i + BATCH_CHUNK_SIZE).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      // Finally the two identity documents themselves.
      const finalBatch = writeBatch(db);
      if (preview.studentExists) finalBatch.delete(doc(db, 'students', uid));
      if (preview.userExists) finalBatch.delete(doc(db, 'users', uid));
      await finalBatch.commit();

      setResult({
        success: true,
        summary: `Deleted ${allDeletable.length} records, removed from ${_refs.classes.length} class(es), and cleared their profile.`,
      });
      setPreview(null);
      setUidInput('');
      setSearchName('');
      setAllStudents((prev) => prev.filter((s) => s.id !== uid));
    } catch (e) {
      console.error(e);
      setResult({ success: false, summary: e.message });
    } finally {
      setBusy(false);
    }
  };

  const confirmationTarget = preview?.displayName || preview?.uid || '';
  const canWipe = preview && !preview.notFound && !preview.error && confirmText.trim() === confirmationTarget;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4">
        <h3 className="font-display text-lg font-semibold text-red-800">⚠ Danger Zone</h3>
        <p className="mt-1 text-sm text-red-700">
          Permanently erases a single account's data — profile, points history, daily-award records, and class
          memberships. This is meant for wiping <strong>test/dummy accounts</strong> before going live, not for
          removing a real student (there's no undo, and real accountability depends on that history staying intact).
          This tool cannot delete the account's actual sign-in — do that separately in Firebase Console →
          Authentication → Users.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="font-display font-semibold text-plum-900">Find the account</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-plum-600">Search by name</label>
            <input
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Type a student's name…"
              className="input"
            />
            {nameMatches.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-plum-100">
                {nameMatches.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        setUidInput(s.id);
                        setSearchName('');
                        loadPreview(s.id);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-plum-50"
                    >
                      {s.displayName} <span className="text-plum-400">· {s.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-plum-600">
                Or paste a UID directly (Authentication → Users)
              </label>
              <input
                value={uidInput}
                onChange={(e) => setUidInput(e.target.value)}
                placeholder="e.g. FxwtdYGLnRb20QEWWADVB6liCti2"
                className="input font-mono text-sm"
              />
            </div>
            <button
              onClick={() => loadPreview(uidInput.trim())}
              disabled={!uidInput.trim() || preview === 'loading'}
              className="rounded-xl border border-plum-200 px-4 py-2 text-sm font-medium text-plum-700 hover:bg-plum-50 disabled:opacity-50"
            >
              Look up
            </button>
          </div>
        </div>
      </div>

      {preview === 'loading' && <p className="text-center text-sm text-plum-700/50">Loading…</p>}

      {preview && preview.notFound && (
        <p className="rounded-lg bg-plum-50 px-3 py-2 text-sm text-plum-700">
          No user or student document found for that ID — nothing to delete.
        </p>
      )}

      {preview && preview.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Couldn't load preview: {preview.error}</p>
      )}

      {preview && !preview.notFound && !preview.error && (
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="font-display font-semibold text-plum-900">About to permanently delete</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Item label="Name" value={preview.displayName} />
            <Item label="Email" value={preview.email} />
            <Item label="Total points" value={preview.totalPoints} />
            <Item label="Point transactions" value={preview.txCount} />
            <Item label="Daily-award guard docs" value={preview.awardCount} />
            <Item label="Daily Challenge attempts" value={preview.attemptCount} />
            <Item label="Daily Challenge log entries" value={preview.logCount} />
            <Item
              label="Class memberships"
              value={preview.classes.length ? preview.classes.map((c) => c.className).join(', ') : 'None'}
            />
          </dl>

          <div className="mt-4 border-t border-plum-100 pt-4">
            <label className="mb-1 block text-xs font-medium text-plum-600">
              Type <span className="font-semibold">{confirmationTarget}</span> to confirm
            </label>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="input" />
            <button
              onClick={handleWipe}
              disabled={!canWipe || busy}
              className="mt-3 w-full rounded-xl bg-red-600 py-3 font-medium text-white transition hover:bg-red-700 disabled:opacity-40"
            >
              {busy ? 'Deleting…' : "Permanently delete this account's data"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {result.summary}
          {result.success && <> Don't forget to also delete the sign-in account itself in Authentication → Users.</>}
        </p>
      )}
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-plum-500">{label}</dt>
      <dd className="font-medium text-plum-900">{value}</dd>
    </div>
  );
}
