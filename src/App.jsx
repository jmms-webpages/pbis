import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Loading from './components/Loading';
import Login from './pages/Login';
import StudentSetup from './pages/StudentSetup';
import TeacherSetup from './pages/TeacherSetup';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';

function Home() {
  const { role } = useAuth();
  if (role === 'admin') return <AdminDashboard />;
  if (role === 'teacher') return <TeacherDashboard />;
  return <StudentDashboard />;
}

function LoginRoute() {
  const { firebaseUser, loading } = useAuth();
  if (loading) return <Loading />;
  if (firebaseUser) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/setup/student"
            element={
              <ProtectedRoute allowedRoles={['student']} requireSetup={false}>
                <StudentSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setup/teacher"
            element={
              <ProtectedRoute allowedRoles={['teacher']} requireSetup={false}>
                <TeacherSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
