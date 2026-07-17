import { Routes, Route, Navigate } from 'react-router-dom';
import { PartnerAuthProvider, usePartnerAuth } from '../../context/PartnerAuthContext';
import PartnerLogin from './PartnerLogin';
import PartnerShell from './PartnerShell';
import PartnerCenters from './PartnerCenters';
import PartnerJobs from './PartnerJobs';

function PartnerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = usePartnerAuth();
  if (!token) return <Navigate to="/partner/login" replace />;
  return <>{children}</>;
}

/**
 * Mounted at /partner/* in App.tsx. Wrapped in its own PartnerAuthProvider
 * (separate from the admin AuthContext) since wash partners are a distinct
 * role with their own JWT — not gated by admin login at all. Mirrors
 * DealerRoutes.tsx exactly.
 */
export default function PartnerRoutes() {
  return (
    <PartnerAuthProvider>
      <Routes>
        <Route path="login" element={<PartnerLogin />} />
        <Route
          element={
            <PartnerProtectedRoute>
              <PartnerShell />
            </PartnerProtectedRoute>
          }
        >
          <Route index element={<Navigate to="centers" replace />} />
          <Route path="centers" element={<PartnerCenters />} />
          <Route path="jobs" element={<PartnerJobs />} />
        </Route>
      </Routes>
    </PartnerAuthProvider>
  );
}
