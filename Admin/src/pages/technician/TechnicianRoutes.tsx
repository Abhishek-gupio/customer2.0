import { Routes, Route, Navigate } from 'react-router-dom';
import { TechnicianAuthProvider, useTechnicianAuth } from '../../context/TechnicianAuthContext';
import TechnicianLogin from './TechnicianLogin';
import TechnicianShell from './TechnicianShell';
import TechnicianJobs from './TechnicianJobs';

function TechnicianProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useTechnicianAuth();
  if (!token) return <Navigate to="/technician/login" replace />;
  return <>{children}</>;
}

/**
 * Mounted at /technician/* in App.tsx. Wrapped in its own TechnicianAuthProvider
 * (separate from both admin and partner auth) — technicians are the field
 * worker role under a WashPartner, with their own JWT and least-privilege
 * scope (only their assigned jobs). Mirrors PartnerRoutes.tsx / DealerRoutes.tsx.
 */
export default function TechnicianRoutes() {
  return (
    <TechnicianAuthProvider>
      <Routes>
        <Route path="login" element={<TechnicianLogin />} />
        <Route
          element={
            <TechnicianProtectedRoute>
              <TechnicianShell />
            </TechnicianProtectedRoute>
          }
        >
          <Route index element={<Navigate to="jobs" replace />} />
          <Route path="jobs" element={<TechnicianJobs />} />
        </Route>
      </Routes>
    </TechnicianAuthProvider>
  );
}
