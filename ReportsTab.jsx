import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getTodayDateKey } from '../lib/dateKey';

/**
 * dateKey strings ("2026-09-04") sort lexicographically exactly like
 * calendar order, so a plain range query (>= start, <= end) on the string
 * field works without any date-object gymnastics or Cloud Functions.
 */
export default function ReportsTab() {
  const today = getTodayDateKey();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [transactions, setTransactions] = useState([]);
  const [students, setStudents] = useState({});
  const [teachers, setTeachers] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLookups() {
      const [sSnap, tSnap] = await Promise.all([
        getDocs(collection(db, 'students')),
        getDocs(collection(db, 'teachers')),
      ]);
      setStudents(Object.fromEntries(sSnap.docs.map((d) => [d.id, d.data()])));
      setTeachers(Object.fromEntries(tSnap.docs.map((d) => [d.id, d.data()])));
    }
    loadLookups();
  }, []);

  useEffect(() => {
    async function loadTransactions() {
      setLoading(true);
      const snap = await getDocs(
        query(
          collection(db, 'pointTransactions'),
          where('dateKey', '>=', start),
          where('dateKey', '<=', end),
          orderBy('dateKey')
        )
      );
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    loadTransactions();
  }, [start, end]);

  const stats = useMemo(() => {
    const byCategory = {
      SAFE: 0, KIND: 0, RESPONSIBLE: 0, WORK_COMPLETION: 0, ALL_BADGES: 0, ON_TASK: 0,
      DAILY_CHALLENGE: 0, ADMIN_ADJUSTMENT: 0,
    };
    const categoryCounts = {
      SAFE: 0, KIND: 0, RESPONSIBLE: 0, WORK_COMPLETION: 0, ALL_BADGES: 0, ON_TASK: 0, DAILY_CHALLENGE: 0,
    };
    const byGrade = {}; // grade -> {safe,kind,responsible,workCompletion,allBadges,onTask,challenge,total}
    const byTeacher = {}; // teacherId -> {safe,kind,responsible,workCompletion,allBadges,onTask,total}
    let totalPoints = 0;
    const participatingStudents = new Set();

    const emptyGradeRow = () => ({ safe: 0, kind: 0, responsible: 0, workCompletion: 0, allBadges: 0, onTask: 0, challenge: 0, total: 0 });
    const emptyTeacherRow = () => ({ safe: 0, kind: 0, responsible: 0, workCompletion: 0, allBadges: 0, onTask: 0, total: 0 });

    for (const t of transactions) {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.points;
      if (categoryCounts[t.category] !== undefined) categoryCounts[t.category] += 1;
      totalPoints += t.points;
      participatingStudents.add(t.studentId);

      const grade = students[t.studentId]?.grade ?? 'Unknown';
      byGrade[grade] = byGrade[grade] || emptyGradeRow();
      byGrade[grade].total += t.points;
      if (t.category === 'SAFE') byGrade[grade].safe += 1;
      if (t.category === 'KIND') byGrade[grade].kind += 1;
      if (t.category === 'RESPONSIBLE') byGrade[grade].responsible += 1;
      if (t.category === 'WORK_COMPLETION') byGrade[grade].workCompletion += 1;
      if (t.category === 'ALL_BADGES') byGrade[grade].allBadges += 1;
      if (t.category === 'ON_TASK') byGrade[grade].onTask += 1;
      if (t.category === 'DAILY_CHALLENGE') byGrade[grade].challenge += 1;

      if (t.teacherId) {
        byTeacher[t.teacherId] = byTeacher[t.teacherId] || emptyTeacherRow();
        byTeacher[t.teacherId].total += t.points;
        if (t.category === 'SAFE') byTeacher[t.teacherId].safe += 1;
        if (t.category === 'KIND') byTeacher[t.teacherId].kind += 1;
        if (t.category === 'RESPONSIBLE') byTeacher[t.teacherId].responsible += 1;
        if (t.category === 'WORK_COMPLETION') byTeacher[t.teacherId].workCompletion += 1;
        if (t.category === 'ALL_BADGES') byTeacher[t.teacherId].allBadges += 1;
        if (t.category === 'ON_TASK') byTeacher[t.teacherId].onTask += 1;
      }
    }

    return { byCategory, categoryCounts, byGrade, byTeacher, totalPoints, participating: participatingStudents.size };
  }, [transactions, students]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-card">
        <DateField label="From" value={start} onChange={setStart} />
        <DateField label="To" value={end} onChange={setEnd} />
        <button
          onClick={() => {
            setStart(today);
            setEnd(today);
          }}
          className="rounded-lg border border-plum-200 px-3 py-2 text-sm font-medium text-plum-700 hover:bg-plum-50"
        >
          Today only
        </button>
        {loading && <span className="text-xs text-plum-700/50">Loading…</span>}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total points awarded" value={stats.totalPoints} />
        <SummaryCard label="Safe awards" value={stats.categoryCounts.SAFE} />
        <SummaryCard label="Kind awards" value={stats.categoryCounts.KIND} />
        <SummaryCard label="Responsible awards" value={stats.categoryCounts.RESPONSIBLE} />
        <SummaryCard label="Work Completion awards" value={stats.categoryCounts.WORK_COMPLETION} />
        <SummaryCard label="All Badges awards" value={stats.categoryCounts.ALL_BADGES} />
        <SummaryCard label="On Task awards" value={stats.categoryCounts.ON_TASK} />
        <SummaryCard label="Daily Challenge completions" value={stats.categoryCounts.DAILY_CHALLENGE} />
        <SummaryCard label="Students participating" value={stats.participating} />
      </div>

      <div className="rounded-2xl bg-white shadow-card">
        <h3 className="border-b border-plum-100 p-4 font-display text-base font-semibold text-plum-900">
          Grade Statistics
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-plum-500">
              <th className="px-4 py-2">Grade</th>
              <th className="px-4 py-2">Safe</th>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2">Responsible</th>
              <th className="px-4 py-2">Work Completion</th>
              <th className="px-4 py-2">All Badges</th>
              <th className="px-4 py-2">On Task</th>
              <th className="px-4 py-2">Daily Challenge</th>
              <th className="px-4 py-2">Total Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-plum-50">
            {Object.entries(stats.byGrade)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([grade, s]) => (
                <tr key={grade}>
                  <td className="px-4 py-2.5 font-medium text-plum-900">{grade}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.safe}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.kind}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.responsible}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.workCompletion}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.allBadges}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.onTask}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.challenge}</td>
                  <td className="px-4 py-2.5 font-semibold text-plum-900">{s.total}</td>
                </tr>
              ))}
            {Object.keys(stats.byGrade).length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-plum-700/50">
                  No activity in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl bg-white shadow-card">
        <h3 className="border-b border-plum-100 p-4 font-display text-base font-semibold text-plum-900">
          Teacher Statistics
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-plum-500">
              <th className="px-4 py-2">Teacher</th>
              <th className="px-4 py-2">Safe</th>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2">Responsible</th>
              <th className="px-4 py-2">Work Completion</th>
              <th className="px-4 py-2">All Badges</th>
              <th className="px-4 py-2">On Task</th>
              <th className="px-4 py-2">Total Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-plum-50">
            {Object.entries(stats.byTeacher)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([teacherId, s]) => (
                <tr key={teacherId}>
                  <td className="px-4 py-2.5 font-medium text-plum-900">
                    {teachers[teacherId]?.displayName || teacherId}
                  </td>
                  <td className="px-4 py-2.5 text-plum-700">{s.safe}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.kind}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.responsible}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.workCompletion}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.allBadges}</td>
                  <td className="px-4 py-2.5 text-plum-700">{s.onTask}</td>
                  <td className="px-4 py-2.5 font-semibold text-plum-900">{s.total}</td>
                </tr>
              ))}
            {Object.keys(stats.byTeacher).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-plum-700/50">
                  No teacher awards in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-plum-700/40">
        Reports scan point transactions within the selected date range. For very long ranges across
        a full school year, moving this aggregation to a scheduled Cloud Function (Blaze plan) would
        keep it fast as history grows — not necessary at current scale.
      </p>
    </div>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-plum-600">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </label>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <p className="text-xs font-medium text-plum-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-plum-900">{value}</p>
    </div>
  );
}
