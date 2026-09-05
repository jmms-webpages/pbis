import { useEffect, useState } from 'react';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

const GRADES = [6, 7, 8];

export default function RosterTab() {
  const [entries, setEntries] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('teacher');
  const [gradeLevels, setGradeLevels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'roster'));
    setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleGrade = (g) => {
    setGradeLevels((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const handleAdd = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'roster', cleanEmail), {
        role,
        gradeLevels: role === 'teacher' ? gradeLevels : [],
        claimed: false,
      });
      setEmail('');
      setGradeLevels([]);
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="rounded-2xl bg-white shadow-card">
        <h3 className="border-b border-plum-100 p-4 font-display text-lg font-semibold text-plum-900">
          Pre-provisioned Staff ({entries.length})
        </h3>
        {loading ? (
          <p className="p-6 text-center text-sm text-plum-700/50">Loading…</p>
        ) : (
          <ul className="divide-y divide-plum-100">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-medium text-plum-900">{e.id}</p>
                  <p className="text-xs text-plum-700/60">
                    {e.role}
                    {e.gradeLevels?.length ? ` · Grades ${e.gradeLevels.join(', ')}` : ''}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.claimed ? 'bg-green-50 text-green-700' : 'bg-gold-50 text-gold-600'
                  }`}
                >
                  {e.claimed ? 'Signed in' : 'Pending first login'}
                </span>
              </li>
            ))}
            {entries.length === 0 && (
              <li className="p-8 text-center text-sm text-plum-700/50">
                No staff added yet. Add teacher and admin emails so their role is
                assigned automatically on first Google sign-in.
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="h-fit rounded-2xl bg-white p-5 shadow-card">
        <h3 className="font-display font-semibold text-plum-900">Add staff member</h3>
        <p className="mt-1 text-xs text-plum-700/60">
          Their role activates automatically the first time they sign in with this email.
        </p>
        <div className="mt-4 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@school.org"
            className="input"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
          {role === 'teacher' && (
            <div className="flex gap-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGrade(g)}
                  className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium ${
                    gradeLevels.includes(g)
                      ? 'border-plum-600 bg-plum-600 text-white'
                      : 'border-plum-200 text-plum-700'
                  }`}
                >
                  {g}th
                </button>
              ))}
            </div>
          )}
          <button
            onClick={handleAdd}
            disabled={saving || !email.trim()}
            className="w-full rounded-xl bg-plum-700 py-2.5 text-sm font-medium text-white hover:bg-plum-800 disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add to roster'}
          </button>
        </div>
      </div>
    </div>
  );
}
