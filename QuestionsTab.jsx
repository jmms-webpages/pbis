import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const emptyForm = { questionText: '', choices: ['', '', '', ''], correctAnswer: 0, category: '' };

export default function QuestionsTab() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    // Questions and answers are separate collections on purpose: the
    // question doc (text/choices/active) is readable by students so they
    // can take the quiz, but the answer doc is admin-only-readable.
    // Firestore rules validate correctness server-side via get() without
    // ever exposing correctAnswer to a student's client. Fetching both
    // here is fine — only admins load this tab.
    const [qSnap, aSnap] = await Promise.all([
      getDocs(collection(db, 'dailyChallengeQuestions')),
      getDocs(collection(db, 'dailyChallengeAnswers')),
    ]);
    const answers = Object.fromEntries(aSnap.docs.map((d) => [d.id, d.data().correctAnswer]));
    setQuestions(
      qSnap.docs.map((d) => ({ id: d.id, ...d.data(), correctAnswer: answers[d.id] }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (q) => {
    setForm({
      questionText: q.questionText,
      choices: q.choices,
      correctAnswer: q.correctAnswer ?? 0,
      category: q.category || '',
    });
    setEditingId(q.id);
  };

  const handleSave = async () => {
    const cleanedChoices = form.choices.map((c) => c.trim()).filter(Boolean);
    if (!form.questionText.trim() || cleanedChoices.length < 2) {
      alert('Enter a question and at least two answer choices.');
      return;
    }
    setSaving(true);
    try {
      let qId = editingId;
      if (qId) {
        await updateDoc(doc(db, 'dailyChallengeQuestions', qId), {
          questionText: form.questionText.trim(),
          choices: cleanedChoices,
          category: form.category.trim() || null,
        });
      } else {
        const ref = await addDoc(collection(db, 'dailyChallengeQuestions'), {
          questionText: form.questionText.trim(),
          choices: cleanedChoices,
          category: form.category.trim() || null,
          active: true,
          createdAt: serverTimestamp(),
        });
        qId = ref.id;
      }
      // Answer doc always uses the SAME id as the question doc so rules
      // can look it up with a single get() during answer submission.
      await setDoc(doc(db, 'dailyChallengeAnswers', qId), {
        correctAnswer: Number(form.correctAnswer),
      });
      resetForm();
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (q) => {
    await updateDoc(doc(db, 'dailyChallengeQuestions', q.id), { active: !q.active });
    load();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="rounded-2xl bg-white shadow-card">
        <h3 className="border-b border-plum-100 p-4 font-display text-lg font-semibold text-plum-900">
          Question Pool ({questions.length})
        </h3>
        {loading ? (
          <p className="p-6 text-center text-sm text-plum-700/50">Loading…</p>
        ) : (
          <ul className="divide-y divide-plum-100">
            {questions.map((q) => (
              <li key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-plum-900">{q.questionText}</p>
                    <p className="mt-1 text-xs text-plum-700/60">
                      {q.choices.map((c, i) => (
                        <span key={i} className={i === q.correctAnswer ? 'font-semibold text-plum-700' : ''}>
                          {i > 0 && ' · '}
                          {c}
                        </span>
                      ))}
                    </p>
                    {q.category && (
                      <span className="mt-1 inline-block rounded-full bg-plum-50 px-2 py-0.5 text-xs text-plum-600">
                        {q.category}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => handleEdit(q)} className="text-xs text-plum-600 hover:text-plum-900">
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(q)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        q.active ? 'bg-green-50 text-green-700' : 'bg-plum-100 text-plum-500'
                      }`}
                    >
                      {q.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {questions.length === 0 && (
              <li className="p-8 text-center text-sm text-plum-700/50">
                No questions yet — add your first one.
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="h-fit rounded-2xl bg-white p-5 shadow-card">
        <h3 className="font-display font-semibold text-plum-900">
          {editingId ? 'Edit question' : 'New question'}
        </h3>
        <div className="mt-4 space-y-3">
          <textarea
            value={form.questionText}
            onChange={(e) => setForm({ ...form, questionText: e.target.value })}
            placeholder="Question text"
            rows={2}
            className="input"
          />
          {form.choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={Number(form.correctAnswer) === i}
                onChange={() => setForm({ ...form, correctAnswer: i })}
                title="Mark as correct answer"
              />
              <input
                value={c}
                onChange={(e) => {
                  const choices = [...form.choices];
                  choices[i] = e.target.value;
                  setForm({ ...form, choices });
                }}
                placeholder={`Choice ${i + 1}`}
                className="input"
              />
            </div>
          ))}
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Category (optional)"
            className="input"
          />
          <div className="flex gap-2">
            {editingId && (
              <button onClick={resetForm} className="flex-1 rounded-xl border border-plum-200 py-2.5 text-sm font-medium text-plum-700">
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-plum-700 py-2.5 text-sm font-medium text-white hover:bg-plum-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add question'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
