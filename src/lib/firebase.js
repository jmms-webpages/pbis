import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Fill these in from Firebase Console > Project Settings > General > Your apps.
// Values are read from environment variables so real credentials never live
// in source control — copy .env.example to .env.local and fill it in.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

// Which email domains count as "school accounts." Supports a comma-
// separated list, e.g. "jackson.sparcc.org,bearworks.jackson.sparcc.org"
// — Google's own `hd` sign-in parameter only accepts ONE domain, so with
// two-plus domains we skip it and instead check the signed-in account's
// email against this list ourselves right after sign-in (see
// AuthContext.jsx). This is still a UX convenience, not the real
// security boundary — the matching check in firestore.rules is what
// actually enforces it server-side.
export const ALLOWED_SCHOOL_DOMAINS = (import.meta.env.VITE_SCHOOL_GOOGLE_DOMAINS || '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

// Google's `hd` param only ever narrows the account picker to a single
// domain, so it's only worth setting when there's exactly one — with
// multiple domains we leave it off and rely entirely on the post-sign-in
// check instead (which correctly handles any number of domains).
if (ALLOWED_SCHOOL_DOMAINS.length === 1) {
  googleProvider.setCustomParameters({ hd: ALLOWED_SCHOOL_DOMAINS[0] });
}
