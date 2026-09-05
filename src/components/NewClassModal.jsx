import { useState } from 'react';
import { doc, collection, writeBatch, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { generateClassCode } from '../lib/classCode';

export default function NewClassModal({ teacherId, onClose, onCreated }) {
  const [className, setClassName] = useState('');
  const [period, setPeriod] = useState('');
  const [gradeLevel, setGradeLevel] = useState(6);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!className.trim() || !period.trim()) return;
    setSaving(true);
    try {
      // Pre-allocate the class doc's ID so we can reference it from the
      // code-index doc in the SAME atomic batch — this way a class is
      // never left without a working join code (or vice versa).
      const classRef = doc(collection(db, 'classes'));

      // Generate a code and make sure nobody else already has it. The
      // code space (31^6 ≈ 900M) makes collisions astronomically rare,
      // but we still check rather than assume.
      let code = generateClassCode();
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await getDoc(doc(db, 'classCodeIndex', code));
        if (!existing.exists()) break;
        code = generateClassCode();
      }

      const batch = writeBatch(db);
      batch.set(classRef, {
        teacherId,
        className: className.trim(),
        period: period.trim(),
        gradeLevel: Number(gradeLevel),
        studentIds: [],
        classCode: code,
        joinable: true,
        createdAt: serverTimestamp(),
      });
      // Public lookup doc: lets a student resolve a code to a classId
      // with a single get() by ID, without ever needing read access to
      // the class document itself (which stays teacher/admin-only).
      batch.set(doc(db, 'classCodeIndex', code), {
        classId: classRef.id,
        teacherId,
        className: className.trim(),
        period: period.trim(),
        gradeLevel: Number(gradeLevel),
        active: true,
      });
      await batch.commit();
      onCreated(classRef.id);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-plum-900/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="font-display text-lg font-semibold text-plum-900">New class</h3>
        <div className="mt-4 space-y-3">
          <Field label="Class name">
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. 7th Grade Science"
              className="input"
            />
          </Field>
          <Field label="Period">
            <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 2" className="input" />
          </Field>
          <Field label="Grade level">
            <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="input">
              <option value={6}>6th</option>
              <option value={7}>7th</option>
              <option value={8}>8th</option>
            </select>
          </Field>
        </div>
        <div className="mt-6 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-plum-200 py-2.5 text-sm font-medium text-plum-700">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 rounded-xl bg-plum-700 py-2.5 text-sm font-medium text-white hover:bg-plum-800 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create class'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-plum-600">{label}</span>
      {children}
    </label>
  );
}
