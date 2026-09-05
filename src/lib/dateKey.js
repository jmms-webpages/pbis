/**
 * Daily reset strategy for the whole app:
 *
 * We never delete or reset data. Instead every award/attempt is tagged with
 * a `dateKey` string like "2026-09-04". Eligibility ("has this student
 * already gotten Safe today?") is just a lookup keyed by
 * `${studentId}_${dateKey}_${category}` — no scheduled jobs required, which
 * keeps this compatible with the Firebase Spark (free) plan.
 *
 * IMPORTANT: the client-computed dateKey below is only a UX convenience
 * (it's what gets shown/proposed). It must never be trusted as the source
 * of truth for security — Firestore rules independently validate that the
 * dateKey in a document ID matches the *server's* current time
 * (request.time), so a student/teacher can't spoof "yesterday" or
 * "tomorrow" to bypass the once-per-day limits. See firestore.rules,
 * function isValidDateKeyForNow().
 *
 * Note on timezone: rules validate against UTC day boundaries (Firestore
 * security rules have no timezone support). For a US school this means the
 * daily rollover happens in the evening local time, well outside school
 * hours, so it has no practical effect on students/teachers using the app
 * during the school day.
 */

export function getTodayDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateKeyForDisplay(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
