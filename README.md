# PBIS Rewards

A school-wide PBIS (Positive Behavioral Interventions & Supports) points platform for students, teachers, and admins. Built with React + Vite + Tailwind + Firebase (Auth, Firestore, Hosting).

## What this is

- **Students** see their points, grade-level and school-wide leaderboards, and a once-a-day Daily Challenge question worth 10 points.
- **Teachers** manage class rosters and award Safe/Kind/Responsible points (+5 each), individually or in bulk, capped at once per category per student per day **school-wide** (not per teacher).
- **Admins** get a searchable/sortable points table, reports by grade/teacher/date, point corrections with a full audit trail, and manage the Daily Challenge question pool and staff roster.

All of the "once per day," "can't award twice," and "role can't be self-selected" rules are enforced in **`firestore.rules`**, not just hidden in the UI. See the extensive comments in that file — the short version is: every daily-limited award is gated by a document with a deterministic ID (`dailyAwards/{studentId}_{dateKey}_{category}`), which Firestore can only ever create once, and the cached point totals on each student's profile can only change in the same atomic transaction that creates that guard document (enforced via `existsAfter()`), so there's no way to award points without also tripping the once-per-day guard.

## 1. Firebase project setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → enable **Google**.
   - Under Authentication → Settings → Authorized domains, your Firebase Hosting domain is added automatically.
3. **Firestore Database** → Create database → start in **production mode** (the rules in this repo replace the default-deny). Choose a region close to your school.
4. Project Settings → General → "Your apps" → add a **Web app**. Copy the config values into `.env.local` (copy `.env.example` first).
5. Set `VITE_SCHOOL_GOOGLE_DOMAINS` to your Workspace domain(s) — comma-separated if you have more than one (e.g. `jackson.sparcc.org,bearkworks.jackson.sparcc.org`). This gives a friendly error on the sign-in screen for non-school accounts, but it's a UX nicety, not the real gate — see the next paragraph.

**The real enforcement is in `firestore.rules`.** Open it and find `isAllowedSchoolEmail()` near the top — edit the domain list there to match exactly what you put in `VITE_SCHOOL_GOOGLE_DOMAINS`, then redeploy rules (this happens automatically on your next push once GitHub Actions is wired up, or you'll need to redeploy manually if you're editing after that). Beyond the domain check, role elevation (teacher/admin) is still separately gated by the pre-provisioned roster, described below.

## 2. Provision your first admin

Because roles are never self-selected, **you need at least one admin roster entry before anyone signs in**, or the very first person to sign in only ever becomes a student. The cleanest way for the very first admin:

1. In the Firebase Console, go to Firestore → start a collection named `roster`.
2. Add a document with ID = your own school email (all lowercase), containing:
   ```
   role: "admin"
   claimed: false
   gradeLevels: []
   ```
3. Sign in to the app with that email — you'll land in the Admin Dashboard automatically.
4. From there, use the **Staff Roster** tab to add every other teacher and admin's email — no more manual Firestore edits needed after this.

## 3. Push to GitHub and connect CI/CD

This repo includes `.github/workflows/deploy.yml`, which builds and deploys automatically — no local `npm run build`/`firebase deploy` needed:
- **Pull requests** get a temporary Firebase Hosting preview channel (safe to test without touching production).
- **Pushes to `main`** deploy to live Hosting and push `firestore.rules`/`firestore.indexes.json`.

To wire it up:

1. **Create a Firebase service account key** for CI. Easiest path — run this once from any machine with Node (it walks you through creating the service account and adding the GitHub secret automatically):
   ```bash
   npx firebase-tools login
   npx firebase-tools init hosting:github
   ```
   Or manually: Google Cloud Console → IAM & Admin → Service Accounts → create one with **Firebase Hosting Admin** and **Cloud Datastore Owner** (needed for Firestore rules deploys) roles → create a JSON key → paste its full contents into a GitHub secret named `FIREBASE_SERVICE_ACCOUNT`.

2. **Add the rest of the repository secrets** (GitHub repo → Settings → Secrets and variables → Actions → New repository secret). These are the same values that would otherwise go in a local `.env.local` — with GitHub Actions you never create that file at all, since the workflow injects them at build time:

   | Secret | Where to find it |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → General → Your apps |
   | `VITE_FIREBASE_AUTH_DOMAIN` | same page |
   | `VITE_FIREBASE_PROJECT_ID` | same page |
   | `VITE_FIREBASE_STORAGE_BUCKET` | same page |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | same page |
   | `VITE_FIREBASE_APP_ID` | same page |
   | `VITE_SCHOOL_GOOGLE_DOMAINS` | your Workspace domain(s), comma-separated, e.g. `jackson.sparcc.org,bearkworks.jackson.sparcc.org` |

3. Push to `main` (or open a pull request first to get a preview link before it's live). Check the **Actions** tab in GitHub to watch the build/deploy run and see the preview/live URL in the logs.

Every future change is just: edit files → commit → push (or merge a PR) → Actions redeploys automatically.

## 4. Add your question pool

Admin Dashboard → **Daily Challenge Questions** → add a handful of questions about your school's rules/expectations. Each needs at least 2 answer choices and one marked correct. Mark them **Active** to include them in the daily rotation.

## Data model

```
users/{uid}                      role ('student'|'teacher'|'admin'), setupComplete, email, displayName
roster/{email}                   admin-provisioned: role, gradeLevels, claimed
students/{uid}                   grade, totalPoints, safeCount, kindCount, responsibleCount, dailyChallengeCount
teachers/{uid}                   gradeLevels
classes/{classId}                teacherId, className, period, gradeLevel, studentIds[], classCode, joinable
classCodeIndex/{code}            public lookup: classId, teacherId, className, period, gradeLevel, active
                                  — lets a student resolve a code to a class without read access to the class itself
pointTransactions/{autoId}       authoritative audit ledger — studentId, points, category, source, dateKey, timestamp, ...
dailyAwards/{uid_dateKey_cat}    guard docs — deterministic ID makes duplicate awards structurally impossible
dailyChallengeQuestions/{id}     questionText, choices[], active, category  (readable by everyone signed in)
dailyChallengeAnswers/{id}       correctAnswer  (admin-read-only; rules use get() to verify answers server-side)
dailyChallengeAttempts/{id}      lightweight per-student progress UI state (not what gates points)
dailyChallengeLog/{autoId}       audit trail of every correct/incorrect attempt
```

## Firebase plan notes (Spark vs Blaze)

Everything above runs on the **free Spark plan**. A few things are explicitly designed around that constraint (see comments in the code for details):

- No Cloud Functions — role bootstrap, point transactions, and the Daily Challenge are all done with client-side Firestore transactions gated by security rules, not server functions.
- Leaderboards use one-shot reads refreshed on demand rather than live listeners, to avoid a 1,400-student fan-out on every dashboard load.
- The daily rollover uses UTC day boundaries (Firestore rules have no timezone support), which lands in the evening in US time zones — outside school hours, so it doesn't affect real use.

If you outgrow Spark, the natural upgrades (all optional, not required to run this app) are:
- An Auth `onCreate` Cloud Function for more bulletproof role provisioning.
- A scheduled Cloud Function to precompute leaderboard caches if the school grows well past ~5,000 students.
- Timezone-exact midnight rollover via a Cloud Function.

## Known limitations worth knowing about

- The client-side domain check (in `src/lib/firebase.js`/`AuthContext.jsx`) is a UX convenience for a friendlier error message — the actual access control is `isAllowedSchoolEmail()` in `firestore.rules`. Keep both lists in sync when you add/remove a domain.
- The `roster` → `users` role-claim check compares the Google ID token's email directly; enter roster emails in the exact lowercase form your Workspace issues them in.
- Reports scan `pointTransactions` for the selected date range live from the client. This is fast at current scale (~1,400 students, a school year of history); if that ever becomes slow, moving the aggregation to a scheduled Cloud Function (Blaze) is the fix.
