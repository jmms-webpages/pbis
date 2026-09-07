const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/**
 * Returns today's date in YYYY-MM-DD format (local school timezone).
 */
function getTodayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Scheduled Cloud Function (Blaze Plan):
 * Runs every day at midnight (00:00).
 * Picks an active challenge question and publishes it to:
 * 1) dailyChallengeQuestions/daily_{dateKey}
 * 2) dailyChallengeQuestions/today
 *
 * This enables 1,500 students to fetch exactly 1 document on load!
 */
exports.publishDailyQuestion = onSchedule('every day 00:00', async () => {
  const dateKey = getTodayKey();
  const questionsSnap = await db
    .collection('dailyChallengeQuestions')
    .where('active', '==', true)
    .get();

  const validQuestions = questionsSnap.docs
    .filter((d) => !d.id.startsWith('daily_') && d.id !== 'today')
    .map((d) => ({ id: d.id, ...d.data() }));

  if (validQuestions.length === 0) {
    console.log('No active questions found in pool.');
    return;
  }

  // Pick random question
  const randomIndex = Math.floor(Math.random() * validQuestions.length);
  const chosen = validQuestions[randomIndex];

  const payload = {
    questionId: chosen.id,
    questionText: chosen.questionText,
    choices: chosen.choices,
    category: chosen.category || null,
    dateKey,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await Promise.all([
    db.collection('dailyChallengeQuestions').doc(`daily_${dateKey}`).set(payload),
    db.collection('dailyChallengeQuestions').doc('today').set(payload),
  ]);

  console.log(`Successfully published daily question for ${dateKey}: ${chosen.id}`);
});

/**
 * Firestore Triggered Cloud Function (Blaze Plan):
 * Listens for new pointTransactions and maintains system/gradeTotals.
 * This allows all 200 teachers to load school-wide grade totals with
 * exactly 1 read instead of querying 1,500 student documents!
 */
exports.aggregateGradeTotalsOnTransaction = onDocumentCreated(
  'pointTransactions/{txId}',
  async (event) => {
    const data = event.data?.data();
    if (!data || !data.studentId || !data.points) return;

    // Fetch student's grade level
    const studentSnap = await db.collection('students').doc(data.studentId).get();
    if (!studentSnap.exists) return;

    const grade = studentSnap.data()?.grade;
    if (!grade || ![6, 7, 8].includes(grade)) return;

    const statsRef = db.collection('system').doc('gradeTotals');
    await statsRef.set(
      {
        sums: {
          [grade]: admin.firestore.FieldValue.increment(data.points),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
);
