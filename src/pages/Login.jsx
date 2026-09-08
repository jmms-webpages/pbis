import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isFirebaseConfigured, firebaseProjectId } from '../lib/firebase';

export default function Login() {
  const { signIn, authError } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSignIn = async () => {
    setError('');
    setUnauthorizedDomain(null);
    if (!isFirebaseConfigured) {
      setError('Firebase credentials are not yet configured. Please set your Firebase environment variables in Settings to sign in.');
      return;
    }
    setBusy(true);
    try {
      await signIn();
    } catch (e) {
      const code = e?.code || '';
      const message = e?.message || '';

      if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
        const currentHost = window.location.hostname || 'ais-dev-y4ye2xxh7yk2fyt3pwre7h-276960982650.us-west1.run.app';
        setUnauthorizedDomain(currentHost);
        return;
      }

      if (code === 'auth/popup-closed-by-user') {
        setError('The sign-in popup was closed before finishing. Please try again.');
        return;
      }

      if (code === 'auth/popup-blocked') {
        setError('The sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
        return;
      }

      if (code === 'auth/cancelled-popup-request') {
        return;
      }

      if (code === 'auth/network-request-failed') {
        setError('Network error connecting to Firebase. Please check your internet connection.');
        return;
      }

      setError(
        message.startsWith('Please sign in with your school')
          ? message
          : 'Sign-in did not go through. Use your school Google account and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () => {
    if (unauthorizedDomain) {
      navigator.clipboard?.writeText(unauthorizedDomain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const consoleUrl = firebaseProjectId && firebaseProjectId !== 'placeholder-app'
    ? `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`
    : 'https://console.firebase.google.com/';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-plum-900 px-6 py-8">
      {/* Ambient gold & purple arcs matching Jackson branding */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="1000" cy="120" r="380" stroke="#fbbb04" strokeWidth="2" fill="none" opacity="0.4" />
        <circle cx="120" cy="720" r="260" stroke="#7e3ad0" strokeWidth="2" fill="none" opacity="0.4" />
      </svg>

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-paper p-7 sm:p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white p-2 shadow-md ring-2 ring-gold-400">
            <img
              src="/polar-bear-head.png"
              alt="Jackson Polar Bears"
              width="64"
              height="64"
              loading="eager"
              decoding="sync"
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="font-display text-2xl font-semibold text-plum-900">PBIS Rewards</h1>
          <p className="mt-1 text-sm text-plum-700/70">Sign in with your school Google account</p>
        </div>

        <button
          onClick={handleSignIn}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-plum-200 bg-white px-4 py-3 font-medium text-plum-900 shadow-card transition hover:border-plum-300 hover:bg-plum-50 disabled:opacity-60"
        >
          <GoogleIcon />
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        {unauthorizedDomain && (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-left shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                !
              </span>
              <h3 className="font-display text-sm font-semibold text-amber-950">
                Authorize Domain in Firebase
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-amber-900">
              Firebase Authentication requires this domain to be added to your Authorized Domains list before Google Sign-In can complete:
            </p>

            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-amber-200 bg-white p-2 text-xs">
              <code className="flex-1 truncate font-mono text-plum-900 select-all font-semibold">
                {unauthorizedDomain}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-plum-100 px-2.5 py-1 text-xs font-medium text-plum-900 hover:bg-plum-200 transition"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-amber-900">
              <li>
                Open the{' '}
                <a
                  href={consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-plum-800 underline hover:text-plum-950"
                >
                  Firebase Auth Settings ↗
                </a>
              </li>
              <li>Under <strong>Authorized domains</strong>, click <strong>Add domain</strong></li>
              <li>Paste the copied domain (or <code>run.app</code>) and click <strong>Done</strong></li>
            </ol>

            <button
              type="button"
              onClick={handleSignIn}
              disabled={busy}
              className="mt-3.5 w-full rounded-lg bg-plum-800 py-2 text-xs font-semibold text-white shadow hover:bg-plum-900 transition"
            >
              {busy ? 'Connecting…' : 'Try Signing In Again'}
            </button>
          </div>
        )}

        {(error || authError) && !unauthorizedDomain && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error || authError}</p>
        )}

        {!isFirebaseConfigured && !unauthorizedDomain && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Firebase configuration needed: Set your Firebase environment variables in Settings to connect your project.
          </div>
        )}

        <p className="mt-7 text-center text-xs text-plum-700/50">
          Your role is assigned by your school — there's nothing to select here.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}
