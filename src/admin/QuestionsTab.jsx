import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getTodayDateKey, formatDateKeyForDisplay } from '../lib/dateKey';

const emptyForm = { questionText: '', choices: ['', '', '', ''], correctAnswer: 0, category: '' };

export default function QuestionsTab() {
  const dateKey = getTodayDateKey();
  const [questions, setQuestions] = useState([]);
  const [todayQuestion, setTodayQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [settingToday, setSettingToday] = useState(false);

  const load = async () => {
    setLoading(true);
    // Questions and answers are separate collections on purpose: the
    // question doc (text/choices/active) is readable by students so they
    // can take the quiz, but the answer doc is admin-only-readable.
    const [qSnap, aSnap, todaySnap] = await Promise.all([
      getDocs(collection(db, 'dailyChallengeQuestions')),
      getDocs(collection(db, 'dailyChallengeAnswers')),
      getDoc(doc(db, 'dailyChallengeQuestions', `daily_${dateKey}`)),
    ]);
    const answers = Object.fromEntries(aSnap.docs.map((d) => [d.id, d.data().correctAnswer]));
    
    // Filter out internal singleton docs from pool
    const regularQuestions = qSnap.docs
      .filter((d) => !d.id.startsWith('daily_') && d.id !== 'today')
      .map((d) => ({ id: d.id, ...d.data(), correctAnswer: answers[d.id] }));

    setQuestions(regularQuestions);

    if (todaySnap.exists()) {
      setTodayQuestion(todaySnap.data());
    } else {
      setTodayQuestion(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  const setQuestionAsToday = async (q) => {
    setSettingToday(true);
    try {
      const payload = {
        questionId: q.id,
        questionText: q.questionText,
        choices: q.choices,
        category: q.category || null,
        dateKey,
        updatedAt: serverTimestamp(),
      };
      await Promise.all([
        setDoc(doc(db, 'dailyChallengeQuestions', `daily_${dateKey}`), payload),
        setDoc(doc(db, 'dailyChallengeQuestions', 'today'), payload),
      ]);
      setTodayQuestion(payload);
    } catch (e) {
      console.error('Failed to set question of the day', e);
      alert('Error publishing Question of the Day.');
    } finally {
      setSettingToday(false);
    }
  };

  const handlePickRandomForToday = async () => {
    const activeOnes = questions.filter((q) => q.active);
    if (activeOnes.length === 0) {
      alert('No active questions in the pool. Create or activate a question first.');
      return;
    }
    const chosen = activeOnes[Math.floor(Math.random() * activeOnes.length)];
    await setQuestionAsToday(chosen);
  };

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
    <div className="space-y-6">
      {/* 1-Read Question of the Day Optimization Panel */}
      <div className="rounded-2xl border border-gold-200 bg-gold-50/60 p-5 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <h3 className="font-display text-base font-semibold text-plum-900">
                Question of the Day — Blaze 1-Read Mode
              </h3>
            </div>
            <p className="mt-1 text-xs text-plum-700/70">
              Students fetch only this single document for {formatDateKeyForDisplay(dateKey)}, cutting daily school reads from ~20,000 to ~1,500.
            </p>
          </div>
          <button
            onClick={handlePickRandomForToday}
            disabled={settingToday || questions.length === 0}
            className="shrink-0 rounded-xl bg-plum-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-plum-800 disabled:opacity-50"
          >
            {settingToday ? 'Publishing…' : '🎲 Pick Random Active Question'}
          </button>
        </div>

        {todayQuestion ? (
          <div className="mt-4 rounded-xl border border-gold-300/80 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gold-700">
                Active for {todayQuestion.dateKey || dateKey}
              </span>
              {todayQuestion.category && (
                <span className="rounded-full bg-plum-100 px-2 py-0.5 text-xs text-plum-700">
                  {todayQuestion.category}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-medium text-plum-900">{todayQuestion.questionText}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-plum-700/80">
              {todayQuestion.choices?.map((c, i) => (
                <div key={i} className="rounded-lg bg-plum-50/60 px-2.5 py-1.5 border border-plum-100">
                  <span className="font-semibold text-plum-900">{String.fromCharCode(65 + i)}.</span> {c}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-plum-300 bg-white/70 p-4 text-center">
            <p className="text-xs text-plum-700/80">
              No Question of the Day published for today yet. The system will automatically serve a consistent question via hash or you can click "Publish for Today" on any question below.
            </p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl bg-white shadow-card">
          <h3 className="border-b border-plum-100 p-4 font-display text-lg font-semibold text-plum-900">
            Question Pool ({questions.length})
          </h3>
          {loading ? (
            <p className="p-6 text-center text-sm text-plum-700/50">Loading…</p>
          ) : (
            <ul className="divide-y divide-plum-100">
              {questions.map((q) => {
                const isToday = todayQuestion?.questionId === q.id;
                return (
                  <li key={q.id} className={`p-4 transition ${isToday ? 'bg-gold-50/30' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-plum-900">{q.questionText}</p>
                          {isToday && (
                            <span className="rounded-full bg-gold-400/30 px-2 py-0.5 text-[10px] font-bold text-plum-900">
                              TODAY'S Q
                            </span>
                          )}
                        </div>
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
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => setQuestionAsToday(q)}
                          disabled={settingToday || isToday}
                          title="Set as Question of the Day"
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                            isToday
                              ? 'border-gold-300 bg-gold-100 text-plum-800'
                              : 'border-plum-200 text-plum-700 hover:bg-plum-50'
                          }`}
                        >
                          {isToday ? 'Active Today' : 'Publish for Today'}
                        </button>
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
                );
              })}
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
    </div>
  );
}
