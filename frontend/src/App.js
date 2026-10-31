import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import Layout              from './components/common/Layout';
import LoginPage           from './pages/LoginPage';
import RegisterPage        from './pages/RegisterPage';
import ForgotPasswordPage  from './pages/ForgotPasswordPage';
import ResetPasswordPage   from './pages/ResetPasswordPage';
import DashboardPage       from './pages/DashboardPage';
import MedicationsPage     from './pages/MedicationsPage';
import SchedulePage        from './pages/SchedulePage';
import AdherencePage       from './pages/AdherencePage';
import PrescriptionsPage   from './pages/PrescriptionsPage';
import EmotionsPage        from './pages/EmotionsPage';
import AlertsPage          from './pages/AlertsPage';
import PatientsPage        from './pages/PatientsPage';
import ActivityPage        from './pages/ActivityPage';
import ProfilePage         from './pages/ProfilePage';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Public auth */}
      <Route path="/login"                    element={!user ? <LoginPage />           : <Navigate to="/dashboard" />} />
      <Route path="/register"                 element={!user ? <RegisterPage />        : <Navigate to="/dashboard" />} />
      <Route path="/forgot-password"          element={!user ? <ForgotPasswordPage />  : <Navigate to="/dashboard" />} />
      <Route path="/reset-password/:token"    element={<ResetPasswordPage />} />

      {/* Protected */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard"     element={<DashboardPage />} />
        <Route path="medications"   element={<MedicationsPage />} />
        <Route path="schedule"      element={<SchedulePage />} />
        <Route path="adherence"     element={<AdherencePage />} />
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="emotions"      element={<EmotionsPage />} />
        <Route path="alerts"        element={<AlertsPage />} />
        <Route path="activity"      element={<ActivityPage />} />
        <Route path="patients"      element={<ProtectedRoute roles={['doctor','caregiver']}><PatientsPage /></ProtectedRoute>} />
        <Route path="profile"       element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(28,31,29,0.12)',
            },
            success: { iconTheme: { primary: '#2D6A4F', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#C0392B', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
