# PBIS Rewards

A school-wide PBIS (Positive Behavioral Interventions & Supports) points platform for students, teachers, and admins. Built with React + Vite + Tailwind + Firebase (Authentication + Firestore only — the actual website is hosted elsewhere; see Step 4 below).

## What this is

- **Students** see their points, grade-level and school-wide leaderboards, and a once-a-day Daily Challenge question worth 10 points.
- **Teachers** manage class rosters and award Safe/Kind/Responsible points (+5 each), individually or in bulk, capped at once per category per student per day **school-wide** (not per teacher).
- **Admins** get a searchable/sortable points table, reports by grade/teacher/date, point corrections with a full audit trail, and manage the Daily Challenge question pool and staff roster.

All of the "once per day," "can't award twice," and "role can't be self-selected" rules are enforced in **`firestore.rules`**, not just hidden in the UI. See the extensive comments in that file — the short version is: every daily-limited award is gated by a document with a deterministic ID (`dailyAwards/{studentId}_{dateKey}_{category}`), which Firestore can only ever create once, and the cached point totals on each student's profile can only change in the same atomic transaction that creates that guard document (enforced via `existsAfter()`), so there's no way to award points without also tripping the once-per-day guard.

## 1. Firebase project setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → enable **Google**.
3. **Firestore Database** → Create database → start in **production mode** (the rules in this repo replace the default-deny). Choose a region close to your school.
4. Project Settings → General → "Your apps" → add a **Web app**. You don't need to check "also set up Firebase Hosting" — leave that unchecked. Copy the six config values shown into `.env.local` (copy `.env.example` first) if you're running locally, or into wherever your host's environment variables go (see Step 4).
5. Set `VITE_SCHOOL_GOOGLE_DOMAINS` to your Workspace domain(s) — comma-separated if you have more than one (e.g. `jackson.sparcc.org,bearkworks.jackson.sparcc.org`). This gives a friendly error on the sign-in screen for non-school accounts, but it's a UX nicety, not the real gate — see the next paragraph.

**The real enforcement is in `firestore.rules`.** Open it and find `isAllowedSchoolEmail()` near the top — edit the domain list there to match exactly what you put in `VITE_SCHOOL_GOOGLE_DOMAINS`, then publish it (see Step 2 below). Beyond the domain check, role elevation (teacher/admin) is still separately gated by the pre-provisioned roster, described below.

## 2. Publish your Firestore rules and indexes

No CLI or service account needed for this — just paste and click:

1. In Firebase Console, go to **Firestore Database → Rules**.
2. Open `firestore.rules` from this repo, select all, copy it.
3. Paste it into the Rules editor in Firebase Console, replacing what's there.
4. Click **Publish**.
5. For indexes: go to **Firestore Database → Indexes → Composite**, and add each entry listed in `firestore.indexes.json` by hand using the "Create index" button (collection name, fields, and sort order for each). Alternatively, skip this for now — Firestore will show a direct "create this index" link in the browser console the first time a query needs one that's missing, which you can just click.

Any time you or I change `firestore.rules` going forward, repeat steps 2–4 — it's a two-minute copy/paste, not a deploy pipeline.

## 3. Push your code to GitHub

Unzip the project, then either use GitHub Desktop (File → Add Local Repository → Publish) or:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

## 4. Host the actual website

This repo builds to a folder of static files (`npm run build` → a `dist` folder) — any static host works. Pick whichever you're already comfortable with:

- **Netlify** or **Vercel** — connect your GitHub repo through their website (sign in with GitHub, pick the repo), no CLI needed. Set the build command to `npm run build` and the output folder to `dist`. Add the same Firebase config values from Step 1 as environment variables in their dashboard (same names as in `.env.example`, e.g. `VITE_FIREBASE_API_KEY`). Once connected, every push to `main` redeploys automatically — that's the only "CI/CD" this project needs now.
- **GitHub Pages** — works too, though it needs a small Vite config tweak for the base path; ask if you want to go this route and we'll set it up.
- Your school/district's own web server — build locally (`npm run build`) and upload the contents of `dist` wherever static files are served from.

Whichever you choose, add its domain to Firebase Console → **Authentication → Settings → Authorized domains**, or Google Sign-In will refuse to work there.

## 5. Provision your first admin

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

## 6. Add your question pool

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
