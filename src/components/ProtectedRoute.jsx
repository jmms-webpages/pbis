import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

/**
 * Route guard. This is UX convenience only — the real enforcement of "who
 * can see/write what" lives in firestore.rules. Hiding a route here just
 * avoids showing a student a teacher-shaped page; it grants no data access
 * that the rules wouldn't already allow.
 */
export default function ProtectedRoute({ allowedRoles, requireSetup = true, children }) {
  const { firebaseUser, profile, loading } = useAuth();

  if (loading) return <Loading />;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (!profile) return <Loading label="Setting up your account" />;

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  if (requireSetup && !profile.setupComplete) {
    if (profile.role === 'student') return <Navigate to="/setup/student" replace />;
    if (profile.role === 'teacher') return <Navigate to="/setup/teacher" replace />;
  }

  return children;
}
