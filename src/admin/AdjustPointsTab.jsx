import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { adminAdjustPoints } from '../lib/pbis';

const CATEGORY_OPTIONS = [
  { value: 'ADMIN_ADJUSTMENT', label: 'General adjustment' },
  { value: 'SAFE', label: 'Safe correction' },
  { value: 'KIND', label: 'Kind correction' },
  { value: 'RESPONSIBLE', label: 'Responsible correction' },
  { value: 'WORK_COMPLETION', label: 'Work Completion correction' },
  { value: 'ALL_BADGES', label: 'All Badges correction' },
  { value: 'ON_TASK', label: 'On Task correction' },
  { value: 'DAILY_CHALLENGE', label: 'Daily Challenge correction' },
];

export default function AdjustPointsTab({ adminId }) {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('ADMIN_ADJUSTMENT');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState(null); // {type, text}
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'students')).then((snap) =>
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, []);

  const matches =
    search.trim().length >= 2
      ? students.filter((s) => (s.displayName || '').toLowerCase().includes(search.toLowerCase()))
      : [];

  const handleSubmit = async () => {
    setStatus(null);
    const amt = Number(amount);
    if (!selectedStudent || !amt || !reason.trim()) {
      setStatus({ type: 'error', text: 'Select a student, enter a non-zero amount, and provide a reason.' });
      return;
    }
    setSaving(true);
    try {
      await adminAdjustPoints({
        studentId: selectedStudent.id,
        amount: amt,
        category,
        reason,
        adminId,
      });
      setStatus({ type: 'success', text: `Applied ${amt > 0 ? '+' : ''}${amt} points to ${selectedStudent.displayName}.` });
      setAmount('');
      setReason('');
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-card">
      <h3 className="font-display text-lg font-semibold text-plum-900">Adjust Points</h3>
      <p className="mt-1 text-sm text-plum-700/60">
        Corrections are recorded as a new audit entry — they never overwrite history.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-plum-600">Student</label>
          {selectedStudent ? (
            <div className="flex items-center justify-between rounded-lg border border-plum-200 px-3 py-2">
              <span className="text-sm text-plum-900">{selectedStudent.displayName}</span>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-xs text-plum-500 hover:text-plum-800"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                className="input"
              />
              {matches.length > 0 && (
                <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-plum-100">
                  {matches.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => {
                          setSelectedStudent(s);
                          setSearch('');
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-plum-50"
                      >
                        {s.displayName} <span className="text-plum-400">· Grade {s.grade}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-plum-600">
            Amount (use a negative number to subtract)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 10 or -5"
            className="input"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-plum-600">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-plum-600">Reason (required)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Corrected duplicate entry from 9/3"
            className="input"
          />
        </div>

        {status && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}
          >
            {status.text}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full rounded-xl bg-plum-700 py-3 font-medium text-white transition hover:bg-plum-800 disabled:opacity-50"
        >
          {saving ? 'Applying…' : 'Apply adjustment'}
        </button>
      </div>
    </div>
  );
}
