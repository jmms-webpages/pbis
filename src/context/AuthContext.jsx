import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, ALLOWED_SCHOOL_DOMAINS } from '../lib/firebase';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Role bootstrap logic (runs once, right after first sign-in):
 *
 * 1. Look for a pre-provisioned entry in roster/{email} (admins create these
 *    ahead of time for staff — "this email is a teacher", "this email is an
 *    admin"). If found, create users/{uid} with that role and mark the
 *    roster entry claimed.
 * 2. If no roster entry exists, the account defaults to role: 'student'.
 *    This is safe because a bare student role has no elevated privileges —
 *    it cannot self-promote, and only an existing admin can ever change
 *    users/{uid}.role afterward (enforced in firestore.rules).
 *
 * This whole thing runs as a single Firestore transaction so two rapid
 * sign-ins (e.g. opening the app in two tabs) can't create two different
 * user docs or double-claim a roster entry.
 */
async function bootstrapUserDocument(firebaseUser) {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const rosterRef = doc(db, 'roster', firebaseUser.email.toLowerCase());

  return runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (userSnap.exists()) {
      return userSnap.data();
    }

    const rosterSnap = await tx.get(rosterRef);
    let role = 'student';
    let gradeLevels = [];

    if (rosterSnap.exists() && !rosterSnap.data().claimed) {
      role = rosterSnap.data().role || 'student';
      gradeLevels = rosterSnap.data().gradeLevels || [];
      tx.update(rosterRef, { claimed: true, claimedBy: firebaseUser.uid, claimedAt: serverTimestamp() });
    }

    const newUserDoc = {
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL || null,
      role,
      setupComplete: false,
      createdAt: serverTimestamp(),
    };
    tx.set(userRef, newUserDoc);

    // Create the matching role-profile stub so downstream pages have
    // somewhere to write setup data (grade for students, gradeLevels for
    // teachers) without ever touching the protected `users` doc's role field.
    if (role === 'student') {
      tx.set(doc(db, 'students', firebaseUser.uid), {
        displayName: firebaseUser.displayName,
        // Split for prefix-searching by either first or last name — see
        // AddStudentsModal, which runs two bounded prefix queries (one
        // per field) instead of scanning the whole students collection.
        firstNameLower: (firebaseUser.displayName || '').trim().split(/\s+/)[0]?.toLowerCase() || '',
        lastNameLower: (firebaseUser.displayName || '').trim().split(/\s+/).slice(-1)[0]?.toLowerCase() || '',
        email: firebaseUser.email,
        grade: null,
        totalPoints: 0,
        safeCount: 0,
        kindCount: 0,
        responsibleCount: 0,
        workCompletionCount: 0,
        allBadgesCount: 0,
        onTaskCount: 0,
        dailyChallengeCount: 0,
        createdAt: serverTimestamp(),
      });
    } else if (role === 'teacher') {
      tx.set(doc(db, 'teachers', firebaseUser.uid), {
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        gradeLevels,
        createdAt: serverTimestamp(),
      });
    }

    return newUserDoc;
  });
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null); // users/{uid} doc
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid));
    setProfile(snap.exists() ? { id: uid, ...snap.data() } : null);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setFirebaseUser(user);
      if (user) {
        const data = await bootstrapUserDocument(user);
        setProfile({ id: user.uid, ...data });
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider);
    // With 2+ allowed domains, Google's own account picker can't filter
    // by domain (its `hd` param only takes one), so we check here instead
    // and immediately sign back out if it's not a recognized school
    // account. This is a UX guard, not the real security boundary — the
    // matching check in firestore.rules is what actually enforces it.
    if (ALLOWED_SCHOOL_DOMAINS.length > 0) {
      const emailDomain = (result.user.email || '').split('@')[1]?.toLowerCase();
      if (!ALLOWED_SCHOOL_DOMAINS.includes(emailDomain)) {
        await firebaseSignOut(auth);
        throw new Error(
          `Please sign in with your school Google account (${ALLOWED_SCHOOL_DOMAINS.join(' or ')}).`
        );
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value = {
    firebaseUser,
    profile,
    role: profile?.role || null,
    loading,
    signIn,
    signOut,
    refreshProfile: () => firebaseUser && refreshProfile(firebaseUser.uid),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
