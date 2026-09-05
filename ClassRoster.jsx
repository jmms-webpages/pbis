import { useEffect, useState, useMemo } from 'react';
import {
  doc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  awardTeacherPoints,
  awardTeacherPointsBulk,
  PER_STUDENT_CATEGORIES,
  WHOLE_CLASS_CATEGORIES,
} from '../lib/pbis';
import { generateClassCode } from '../lib/classCode';
import { getTodayDateKey } from '../lib/dateKey';

export default function ClassRoster({ classData, teacherId }) {
  const [students, setStudents] = useState([]); // {id, displayName, ...}
  const [todayAwards, setTodayAwards] = useState({}); // studentId -> Set(category)
  const [selected, setSelected] = useState(new Set());
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(null); // { category, scope: 'selected' | 'class' }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const dateKey = getTodayDateKey();

  // Reset selection when switching classes
  useEffect(() => {
    setSelected(new Set());
  }, [classData.id]);

  // Load roster student profiles
  useEffect(() => {
    async function loadRoster() {
      if (!classData.studentIds?.length) {
        setStudents([]);
        return;
      }
      // Firestore 'in' queries cap at 30 — chunk for larger rosters.
      const chunks = [];
      for (let i = 0; i < classData.studentIds.length; i += 30) {
        chunks.push(classData.studentIds.slice(i, i + 30));
      }
      const all = [];
      for (const chunk of chunks) {
        const snap = await getDocs(query(collection(db, 'students'), where('__name__', 'in', chunk)));
        snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
      }
      all.sort((a, b) => (a.lastNameLower || a.displayName || '').localeCompare(b.lastNameLower || b.displayName || ''));
      setStudents(all);
    }
    loadRoster();
  }, [classData.studentIds]);

  // Load today's award guard docs for everyone in this roster, so buttons
  // reflect school-wide state (any teacher, any class, any of the six
  // categories) not just this class.
  useEffect(() => {
    async function loadAwards() {
      if (students.length === 0) {
        setTodayAwards({});
        return;
      }
      const allCategories = [...PER_STUDENT_CATEGORIES, ...WHOLE_CLASS_CATEGORIES];
      const map = {};
      await Promise.all(
        students.map(async (s) => {
          const results = await Promise.all(
            allCategories.map(async (c) => {
              const snap = await getDocs(
                query(
                  collection(db, 'dailyAwards'),
                  where('studentId', '==', s.id),
                  where('dateKey', '==', dateKey),
                  where('category', '==', c.id)
                )
              );
              return [c.id, !snap.empty];
            })
          );
          map[s.id] = new Set(results.filter(([, awarded]) => awarded).map(([cat]) => cat));
        })
      );
      setTodayAwards(map);
    }
    loadAwards();
  }, [students, dateKey]);

  const allSelected = students.length > 0 && selected.size === students.length;

  const toggleStudent = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(students.map((s) => s.id)));
  };

  const handleSingleAward = async (studentId, category) => {
    setBusy(true);
    try {
      await awardTeacherPoints({ studentId, category, teacherId, classId: classData.id });
      setTodayAwards((prev) => ({
        ...prev,
        [studentId]: new Set([...(prev[studentId] || []), category]),
      }));
    } catch (e) {
      if (!String(e.message).startsWith('ALREADY_AWARDED')) console.error(e);
    } finally {
      setBusy(false);
    }
  };

  // For the confirmation dialog: how many students would actually receive
  // this award (excludes anyone already awarded that category today).
  const eligibleIds = useMemo(() => {
    if (!confirmBulk) return [];
    const pool = confirmBulk.scope === 'class' ? students.map((s) => s.id) : [...selected];
    return pool.filter((id) => !todayAwards[id]?.has(confirmBulk.category));
  }, [confirmBulk, selected, students, todayAwards]);

  const handleConfirmBulk = async () => {
    setBusy(true);
    try {
      const result = await awardTeacherPointsBulk({
        studentIds: eligibleIds,
        category: confirmBulk.category,
        teacherId,
        classId: classData.id,
      });
      setTodayAwards((prev) => {
        const next = { ...prev };
        result.awarded.forEach((id) => {
          next[id] = new Set([...(next[id] || []), confirmBulk.category]);
        });
        return next;
      });
      const label =
        [...PER_STUDENT_CATEGORIES, ...WHOLE_CLASS_CATEGORIES].find((c) => c.id === confirmBulk.category)?.label ||
        confirmBulk.category;
      setToast(`Gave ${label} to ${result.awarded.length} student${result.awarded.length === 1 ? '' : 's'}.`);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(false);
      setConfirmBulk(null);
    }
  };

  return (
    <div className="space-y-4">
      <ClassCodeCard classData={classData} />

      {/* Whole-class quick actions */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-plum-500">
          Give the whole class +5 points
        </p>
        <div className="flex flex-wrap gap-2">
          {WHOLE_CLASS_CATEGORIES.map((c) => (
            <button
              key={c.id}
              disabled={students.length === 0 || busy}
              onClick={() => setConfirmBulk({ category: c.id, scope: 'class' })}
              className="rounded-xl bg-gold-400 px-4 py-2.5 text-sm font-semibold text-plum-900 transition hover:bg-gold-300 disabled:opacity-40"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-plum-100 p-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-plum-900">{classData.className}</h3>
            <p className="text-xs text-plum-700/60">
              Period {classData.period} · Grade {classData.gradeLevel} · {students.length} students
            </p>
          </div>
          <button
            onClick={() => setShowAddStudents(true)}
            className="rounded-lg border border-plum-200 px-3 py-1.5 text-sm font-medium text-plum-700 hover:bg-plum-50"
          >
            + Add students
          </button>
        </div>

        {students.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-plum-100 p-4">
            <label className="flex items-center gap-2 text-sm text-plum-700">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Select all ({selected.size} selected)
            </label>
            <div className="ml-auto flex gap-2">
              {PER_STUDENT_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  disabled={selected.size === 0}
                  onClick={() => setConfirmBulk({ category: c.id, scope: 'selected' })}
                  className="rounded-lg bg-plum-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-plum-800 disabled:opacity-40"
                >
                  {c.label} +5
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Horizontal roster rows */}
        <ul className="divide-y divide-plum-100">
          {students.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleStudent(s.id)} />
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-plum-600 text-sm font-semibold text-white">
                {(s.displayName || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-plum-900">{s.displayName}</p>
                <p className="text-xs text-plum-700/50">{s.totalPoints ?? 0} pts total</p>
              </div>
              <div className="flex gap-2">
                {PER_STUDENT_CATEGORIES.map((c) => {
                  const already = todayAwards[s.id]?.has(c.id);
                  return (
                    <button
                      key={c.id}
                      disabled={already || busy}
                      onClick={() => handleSingleAward(s.id, c.id)}
                      className="rounded-lg bg-plum-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-plum-800 disabled:cursor-not-allowed disabled:bg-plum-100 disabled:text-plum-400"
                    >
                      {c.label} {already ? '✓' : '+5'}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
          {students.length === 0 && (
            <li className="p-8 text-center text-sm text-plum-700/50">No students in this class yet.</li>
          )}
        </ul>
      </div>

      {showAddStudents && <AddStudentsModal classData={classData} onClose={() => setShowAddStudents(false)} />}

      {confirmBulk && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-plum-900/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-plum-900">
              Give{' '}
              {[...PER_STUDENT_CATEGORIES, ...WHOLE_CLASS_CATEGORIES].find((c) => c.id === confirmBulk.category)
                ?.label}{' '}
              to {eligibleIds.length} student{eligibleIds.length === 1 ? '' : 's'}?
            </h3>
            <p className="mt-2 text-sm text-plum-700/70">
              {confirmBulk.scope === 'class'
                ? `Every student currently in ${classData.className} will receive 5 points.`
                : 'Each selected student will receive 5 points.'}{' '}
              Anyone already awarded this today is skipped automatically.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfirmBulk(null)}
                className="flex-1 rounded-xl border border-plum-200 py-2.5 text-sm font-medium text-plum-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulk}
                disabled={busy || eligibleIds.length === 0}
                className="flex-1 rounded-xl bg-plum-700 py-2.5 text-sm font-medium text-white hover:bg-plum-800 disabled:opacity-50"
              >
                {busy ? 'Awarding…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-plum-900 px-4 py-2.5 text-sm text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function ClassCodeCard({ classData }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(classData.classCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail in some contexts (e.g. non-HTTPS) —
      // the code is still visible on screen either way.
    }
  };

  const toggleLock = async () => {
    setBusy(true);
    try {
      const nextJoinable = !classData.joinable;
      const batch = writeBatch(db);
      batch.update(doc(db, 'classes', classData.id), { joinable: nextJoinable });
      batch.update(doc(db, 'classCodeIndex', classData.classCode), { active: nextJoinable });
      await batch.commit();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    setBusy(true);
    try {
      let newCode = generateClassCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await getDoc(doc(db, 'classCodeIndex', newCode));
        if (!existing.exists()) break;
        newCode = generateClassCode();
      }
      const batch = writeBatch(db);
      // Deactivate the old code rather than deleting it outright, so
      // anyone who already had it open just sees "code no longer active"
      // instead of a confusing not-found.
      batch.update(doc(db, 'classCodeIndex', classData.classCode), { active: false });
      batch.set(doc(db, 'classCodeIndex', newCode), {
        classId: classData.id,
        teacherId: classData.teacherId,
        className: classData.className,
        period: classData.period,
        gradeLevel: classData.gradeLevel,
        active: true,
      });
      batch.update(doc(db, 'classes', classData.id), { classCode: newCode, joinable: true });
      await batch.commit();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
      setConfirmRegenerate(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-plum-900 p-4 text-white shadow-card">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-plum-300">Class code</p>
        <p className="font-display text-2xl font-semibold tracking-widest text-gold-300">{classData.classCode}</p>
      </div>
      <button
        onClick={handleCopy}
        className="rounded-lg border border-plum-600 px-3 py-1.5 text-sm text-plum-100 hover:bg-plum-800"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <div className="ml-auto flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            classData.joinable ? 'bg-green-500/20 text-green-300' : 'bg-plum-700 text-plum-300'
          }`}
        >
          {classData.joinable ? 'Open for joining' : 'Locked'}
        </span>
        <button
          onClick={toggleLock}
          disabled={busy}
          className="rounded-lg border border-plum-600 px-3 py-1.5 text-sm text-plum-100 hover:bg-plum-800 disabled:opacity-50"
        >
          {classData.joinable ? 'Lock' : 'Unlock'}
        </button>
        <button
          onClick={() => setConfirmRegenerate(true)}
          disabled={busy}
          className="rounded-lg border border-plum-600 px-3 py-1.5 text-sm text-plum-100 hover:bg-plum-800 disabled:opacity-50"
        >
          Regenerate
        </button>
      </div>

      {confirmRegenerate && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-plum-900/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-plum-900 shadow-2xl">
            <h3 className="font-display text-lg font-semibold">Regenerate class code?</h3>
            <p className="mt-2 text-sm text-plum-700/70">
              The current code <span className="font-mono font-semibold">{classData.classCode}</span> will stop
              working immediately. Students already in the class keep their spot — this only affects new joins.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfirmRegenerate(false)}
                className="flex-1 rounded-xl border border-plum-200 py-2.5 text-sm font-medium text-plum-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                disabled={busy}
                className="flex-1 rounded-xl bg-plum-700 py-2.5 text-sm font-medium text-white hover:bg-plum-800 disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddStudentsModal({ classData, onClose }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function runSearch() {
      const term = search.trim().toLowerCase();
      if (term.length < 2) {
        setResults([]);
        return;
      }
      // Two bounded prefix queries — one against first name, one against
      // last name — run in parallel and merged. This reads only the
      // matching handful of students either way (at most ~30 total),
      // instead of the old approach of reading the entire students
      // collection on every search, and it correctly supports searching
      // by first name OR last name per the spec (a single combined-name
      // field would only ever prefix-match the first name).
      const makeQuery = (field) =>
        query(
          collection(db, 'students'),
          orderBy(field),
          where(field, '>=', term),
          where(field, '<', term + '\uf8ff'),
          limit(15)
        );
      const [byFirst, byLast] = await Promise.all([
        getDocs(makeQuery('firstNameLower')),
        getDocs(makeQuery('lastNameLower')),
      ]);
      const merged = new Map();
      [...byFirst.docs, ...byLast.docs].forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
      const rows = [...merged.values()].sort((a, b) =>
        (a.lastNameLower || '').localeCompare(b.lastNameLower || '')
      );
      setResults(rows);
    }
    const t = setTimeout(runSearch, 250);
    return () => clearTimeout(t);
  }, [search]);

  const togglePick = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (picked.size === 0) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'classes', classData.id), {
        studentIds: arrayUnion(...picked),
      });
      onClose();
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-plum-900/50 px-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-display text-lg font-semibold text-plum-900">Add students</h3>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by first or last name…"
          className="input mt-3"
        />
        <ul className="mt-3 flex-1 divide-y divide-plum-100 overflow-y-auto">
          {results.map((s) => {
            const alreadyInClass = classData.studentIds?.includes(s.id);
            return (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  disabled={alreadyInClass}
                  checked={picked.has(s.id) || alreadyInClass}
                  onChange={() => togglePick(s.id)}
                />
                <span className={`text-sm ${alreadyInClass ? 'text-plum-400' : 'text-plum-900'}`}>
                  {s.displayName} {alreadyInClass && '(already in class)'}
                </span>
              </li>
            );
          })}
          {search.trim().length >= 2 && results.length === 0 && (
            <p className="py-4 text-center text-sm text-plum-700/50">No students found.</p>
          )}
        </ul>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-plum-200 py-2.5 text-sm font-medium text-plum-700">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={saving || picked.size === 0}
            className="flex-1 rounded-xl bg-plum-700 py-2.5 text-sm font-medium text-white hover:bg-plum-800 disabled:opacity-50"
          >
            {saving ? 'Adding…' : `Add ${picked.size || ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
