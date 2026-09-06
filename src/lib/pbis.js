import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getTodayDateKey } from '../lib/dateKey';

/**
 * === Anti-duplicate / anti-race-condition strategy ===
 *
 * Every "can this happen only once per day" rule is enforced by a guard
 * document whose ID is deterministic:
 *
 *   dailyAwards/{studentId}_{dateKey}_{category}
 *
 * Firestore only allows ONE writer to win a `create` on a given document ID
 * — if a second client (another tab, another teacher, a replayed request)
 * tries to create the same guard doc, Firestore rejects it outright, and
 * our security rules additionally require `!exists()` on create. Wrapping
 * the guard-doc creation, the ledger entry, and the totals increment in a
 * single `runTransaction` means all three either happen together or not at
 * all — there is no window where points are added without the guard doc,
 * or vice versa. Firestore transactions also auto-retry on contention, so
 * two simultaneous clicks resolve safely instead of double-awarding.
 */

const CATEGORY_POINTS = {
  SAFE: 5,
  KIND: 5,
  RESPONSIBLE: 5,
  WORK_COMPLETION: 5,
  ALL_BADGES: 5,
  ON_TASK: 5,
  DAILY_CHALLENGE: 10,
};

const CATEGORY_COUNT_FIELD = {
  SAFE: 'safeCount',
  KIND: 'kindCount',
  RESPONSIBLE: 'responsibleCount',
  WORK_COMPLETION: 'workCompletionCount',
  ALL_BADGES: 'allBadgesCount',
  ON_TASK: 'onTaskCount',
  DAILY_CHALLENGE: 'dailyChallengeCount',
};

// Categories a teacher awards to individual students, one at a time,
// from a class roster row.
export const PER_STUDENT_CATEGORIES = [
  { id: 'SAFE', label: 'Safe' },
  { id: 'KIND', label: 'Kind' },
  { id: 'RESPONSIBLE', label: 'Responsible' },
];

// Categories awarded to an entire class at once via a single quick-action
// button (with a confirmation step) rather than per-student.
export const WHOLE_CLASS_CATEGORIES = [
  { id: 'WORK_COMPLETION', label: 'Work Completion' },
  { id: 'ALL_BADGES', label: 'All Badges' },
  { id: 'ON_TASK', label: 'On Task / Productive' },
];

const CAPPED_TEACHER_CATEGORIES = PER_STUDENT_CATEGORIES.concat(
  WHOLE_CLASS_CATEGORIES.filter((c) => c.id !== 'WORK_COMPLETION')
).map((c) => c.id);

/**
 * Awards one of the five once-per-student-per-day capped categories
 * (SAFE/KIND/RESPONSIBLE/ALL_BADGES/ON_TASK). Throws if already awarded
 * today (by ANY teacher — the guard doc ID has no teacherId in it, which
 * is what makes this school-wide rather than per-teacher, per the spec).
 * For WORK_COMPLETION, use awardWorkCompletion() instead — it's
 * deliberately uncapped and has no guard doc at all.
 */
export async function awardTeacherPoints({ studentId, category, teacherId, teacherName, classId, comment }) {
  if (!CAPPED_TEACHER_CATEGORIES.includes(category)) {
    throw new Error('Invalid category for capped teacher award');
  }
  const dateKey = getTodayDateKey();
  const points = CATEGORY_POINTS[category];
  const guardRef = doc(db, 'dailyAwards', `${studentId}_${dateKey}_${category}`);
  const ledgerRef = doc(collection(db, 'pointTransactions'));
  const studentRef = doc(db, 'students', studentId);
  const trimmedComment = comment?.trim() || null;

  await runTransaction(db, async (tx) => {
    const guardSnap = await tx.get(guardRef);
    if (guardSnap.exists()) {
      throw new Error(`ALREADY_AWARDED:${category}`);
    }
    tx.set(guardRef, {
      studentId,
      category,
      dateKey,
      teacherId,
      classId,
      timestamp: serverTimestamp(),
    });
    tx.set(ledgerRef, {
      studentId,
      points,
      category,
      source: 'TEACHER',
      teacherId,
      teacherName: teacherName || null,
      classId,
      dateKey,
      // Only ever set when the teacher actually typed something — kept
      // out of the doc entirely otherwise rather than stored as an empty
      // string, so "has a comment" is a simple truthiness check anywhere
      // this is read later.
      ...(trimmedComment ? { comment: trimmedComment } : {}),
      timestamp: serverTimestamp(),
    });
    tx.update(studentRef, {
      totalPoints: increment(points),
      [CATEGORY_COUNT_FIELD[category]]: increment(1),
      // Required by firestore.rules: these two fields let the rule pair
      // this exact update with the guard-doc creation above via
      // existsAfter(), which is what actually makes duplicate awards
      // impossible even if this function's code were bypassed.
      lastAwardCategory: category,
      lastAwardDateKey: dateKey,
    });
  });
}

/**
 * Awards Work Completion — the one category with NO daily cap. There's
 * no guard doc at all here; instead, the students/{uid} update ties
 * itself to this exact new ledger entry via firestore.rules' getAfter(),
 * which is what stops it from being awardable to a student the teacher
 * doesn't actually teach, even without a once-per-day limit.
 */
export async function awardWorkCompletion({ studentId, teacherId, classId }) {
  const dateKey = getTodayDateKey();
  const ledgerRef = doc(collection(db, 'pointTransactions'));
  const studentRef = doc(db, 'students', studentId);

  await runTransaction(db, async (tx) => {
    tx.set(ledgerRef, {
      studentId,
      points: CATEGORY_POINTS.WORK_COMPLETION,
      category: 'WORK_COMPLETION',
      source: 'TEACHER',
      teacherId,
      classId,
      dateKey,
      timestamp: serverTimestamp(),
    });
    tx.update(studentRef, {
      totalPoints: increment(CATEGORY_POINTS.WORK_COMPLETION),
      workCompletionCount: increment(1),
      lastLedgerId: ledgerRef.id,
    });
  });
}

/**
 * Awards points to a batch of students at once. Runs each student as its
 * own transaction (Firestore transactions are limited in scope/size, and
 * we want one student's success/failure to be independent of another's).
 * Returns a summary so the UI can report "22 awarded, 2 already had it
 * today" instead of failing the whole batch on one collision.
 */
export async function awardTeacherPointsBulk({ studentIds, category, teacherId, teacherName, classId, comment }) {
  const results = { awarded: [], alreadyAwarded: [], failed: [] };
  for (const studentId of studentIds) {
    try {
      await awardTeacherPoints({ studentId, category, teacherId, teacherName, classId, comment });
      results.awarded.push(studentId);
    } catch (e) {
      if (String(e.message).startsWith('ALREADY_AWARDED')) {
        results.alreadyAwarded.push(studentId);
      } else {
        console.error('Award failed for', studentId, e);
        results.failed.push(studentId);
      }
    }
  }
  return results;
}

/**
 * Bulk version of awardWorkCompletion — every student in the list gets
 * credited, every time this is called, with no "already awarded today"
 * filtering (there's nothing to filter — it's uncapped).
 */
export async function awardWorkCompletionBulk({ studentIds, teacherId, classId }) {
  const results = { awarded: [], failed: [] };
  for (const studentId of studentIds) {
    try {
      await awardWorkCompletion({ studentId, teacherId, classId });
      results.awarded.push(studentId);
    } catch (e) {
      console.error('Work Completion award failed for', studentId, e);
      results.failed.push(studentId);
    }
  }
  return results;
}

/**
 * Attempts to claim today's Daily Challenge win. This IS the answer
 * submission: the transaction only succeeds if `selectedAnswer` matches
 * the question's correct answer, which security rules verify via a
 * server-side `get()` on the (otherwise unreadable) answer document —
 * the client never has access to the correct answer, so it can't be
 * inspected or spoofed from devtools.
 *
 * Returns { correct: true } on success. On a wrong answer, Firestore
 * rejects the write (permission-denied); we catch that and return
 * { correct: false } so the UI can show the next question.
 */
export async function submitDailyChallengeAnswer({ studentId, questionId, selectedAnswer }) {
  const dateKey = getTodayDateKey();
  const category = 'DAILY_CHALLENGE';
  const guardRef = doc(db, 'dailyAwards', `${studentId}_${dateKey}_${category}`);
  const ledgerRef = doc(collection(db, 'pointTransactions'));
  const studentRef = doc(db, 'students', studentId);
  const logRef = doc(collection(db, 'dailyChallengeLog'));

  try {
    await runTransaction(db, async (tx) => {
      const guardSnap = await tx.get(guardRef);
      if (guardSnap.exists()) {
        throw new Error('ALREADY_COMPLETED_TODAY');
      }
      // This write only validates if selectedAnswer is correct — see
      // firestore.rules `dailyAwards` create rule.
      tx.set(guardRef, {
        studentId,
        category,
        dateKey,
        questionId,
        selectedAnswer,
        timestamp: serverTimestamp(),
      });
      tx.set(ledgerRef, {
        studentId,
        points: CATEGORY_POINTS.DAILY_CHALLENGE,
        category,
        source: 'DAILY_CHALLENGE',
        questionId,
        dateKey,
        timestamp: serverTimestamp(),
      });
      tx.update(studentRef, {
        totalPoints: increment(CATEGORY_POINTS.DAILY_CHALLENGE),
        dailyChallengeCount: increment(1),
        lastAwardCategory: category,
        lastAwardDateKey: dateKey,
      });
      tx.set(logRef, {
        studentId,
        questionId,
        selectedAnswer,
        result: 'correct',
        dateKey,
        timestamp: serverTimestamp(),
      });
    });
    return { correct: true };
  } catch (e) {
    if (e.message === 'ALREADY_COMPLETED_TODAY') throw e;
    // Wrong answer -> rules rejected the guard-doc write. Log it
    // separately (this write has no points attached, so it's always
    // allowed for the student's own log entries).
    try {
      await runTransaction(db, async (tx) => {
        tx.set(doc(collection(db, 'dailyChallengeLog')), {
          studentId,
          questionId,
          selectedAnswer,
          result: 'incorrect',
          dateKey,
          timestamp: serverTimestamp(),
        });
      });
    } catch (logErr) {
      console.warn('Could not log incorrect attempt', logErr);
    }
    return { correct: false };
  }
}

/**
 * Admin correction. Always additive (never overwrites history) — a
 * negative `amount` subtracts. Category is one of SAFE/KIND/RESPONSIBLE/
 * DAILY_CHALLENGE/ADMIN_ADJUSTMENT depending on what's being corrected;
 * the running counts (safeCount etc.) are only bumped for
 * ADMIN_ADJUSTMENT-tagged corrections to avoid double-counting a
 * category that was already incremented by the original award.
 */
export async function adminAdjustPoints({ studentId, amount, category, reason, adminId }) {
  if (!amount || !reason?.trim()) {
    throw new Error('Amount and reason are required');
  }
  const dateKey = getTodayDateKey();
  const ledgerRef = doc(collection(db, 'pointTransactions'));
  const studentRef = doc(db, 'students', studentId);

  await runTransaction(db, async (tx) => {
    tx.set(ledgerRef, {
      studentId,
      points: amount,
      category: category || 'ADMIN_ADJUSTMENT',
      source: 'ADMIN',
      adminId,
      reason: reason.trim(),
      dateKey,
      timestamp: serverTimestamp(),
    });
    tx.update(studentRef, { totalPoints: increment(amount) });
  });
}
