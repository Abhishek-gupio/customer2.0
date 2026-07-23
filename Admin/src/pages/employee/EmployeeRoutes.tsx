import { Routes, Route, Navigate } from 'react-router-dom';
import { EmployeeAuthProvider, useEmployeeAuth } from '../../context/EmployeeAuthContext';
import EmployeeLogin from './EmployeeLogin';
import EmployeeShell from './EmployeeShell';
import EmployeeListings from './EmployeeListings';
import EmployeeSlots from './EmployeeSlots';
import EmployeeListingLive from './EmployeeListingLive';
import EmployeeBookings from './EmployeeBookings';
import EmployeeHistory from './EmployeeHistory';

function EmployeeProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useEmployeeAuth();
  if (!token) return <Navigate to="/employee/login" replace />;
  return <>{children}</>;
}

/**
 * Mounted at /employee/* in App.tsx. Wrapped in its own EmployeeAuthProvider
 * (separate from dealer/admin) since a dealer's on-ground staff are a
 * distinct, more restricted role — read-only listings, occupy/vacate only.
 */
export default function EmployeeRoutes() {
  return (
    <EmployeeAuthProvider>
      <Routes>
        <Route path="login" element={<EmployeeLogin />} />
        <Route
          element={
            <EmployeeProtectedRoute>
              <EmployeeShell />
            </EmployeeProtectedRoute>
          }
        >
          <Route index element={<Navigate to="listings" replace />} />
          <Route path="listings" element={<EmployeeListings />} />
          <Route path="listings/:id/slots" element={<EmployeeSlots />} />
          <Route path="listings/:id/live" element={<EmployeeListingLive />} />
          <Route path="bookings" element={<EmployeeBookings />} />
          <Route path="history" element={<EmployeeHistory />} />
        </Route>
      </Routes>
    </EmployeeAuthProvider>
  );
}
