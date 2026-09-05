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

// Restrict Google Sign-In to the school's Google Workspace domain.
// Replace with your actual domain. This is a UX convenience only —
// the real enforcement of "who gets what role" happens via the
// `roster` collection + Firestore rules, not this hint.
export const googleProvider = new GoogleAuthProvider();
const SCHOOL_DOMAIN = import.meta.env.VITE_SCHOOL_GOOGLE_DOMAIN || '';
if (SCHOOL_DOMAIN) {
  googleProvider.setCustomParameters({ hd: SCHOOL_DOMAIN });
}
