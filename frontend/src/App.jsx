import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TutoriasPage from './pages/TutoriasPage';
import AvailabilityPage from './pages/AvailabilityPage';
import AppointmentsPage from './pages/AppointmentsPage';
import AppointmentDetailPage from './pages/AppointmentDetailPage';
import DocumentsPage from './pages/DocumentsPage';
import AdminPage from './pages/AdminPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import './styles.css';

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<Navigate to="/app" replace />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/registro" element={<RegisterPage />} />
    <Route path="/recuperar" element={<ForgotPasswordPage />} />
    <Route path="/restablecer" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute />}><Route path="/app" element={<Layout />}>
      <Route index element={<DashboardPage />} />
      <Route element={<ProtectedRoute roles={['mentor']} />}><Route path="tutorias" element={<TutoriasPage />} /></Route>
      <Route element={<ProtectedRoute roles={['mentor']} />}><Route path="disponibilidad" element={<AvailabilityPage />} /></Route>
      <Route path="citas" element={<AppointmentsPage />} />
      <Route path="citas/:id" element={<AppointmentDetailPage />} />
      <Route path="documentos" element={<DocumentsPage />} />
      <Route element={<ProtectedRoute roles={['admin']} />}><Route path="admin" element={<AdminPage />} /></Route>
    </Route></Route>
    <Route path="*" element={<Navigate to="/app" replace />} />
  </Routes></AuthProvider></BrowserRouter>;
}
