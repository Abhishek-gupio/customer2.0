import { Routes, Route, Navigate } from 'react-router-dom';
import { DealerAuthProvider, useDealerAuth } from '../../context/DealerAuthContext';
import DealerLogin from './DealerLogin';
import DealerShell from './DealerShell';
import DealerListings from './DealerListings';
import DealerListingSlots from './DealerListingSlots';
import DealerListingLive from './DealerListingLive';
import DealerBookings from './DealerBookings';
import DealerEmployees from './DealerEmployees';
import DealerHistory from './DealerHistory';

function DealerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useDealerAuth();
  if (!token) return <Navigate to="/dealer/login" replace />;
  return <>{children}</>;
}

/**
 * Mounted at /dealer/* in App.tsx. Wrapped in its own DealerAuthProvider
 * (separate from the admin AuthContext) since dealers are a distinct role
 * with their own JWT — not gated by admin login at all.
 */
export default function DealerRoutes() {
  return (
    <DealerAuthProvider>
      <Routes>
        <Route path="login" element={<DealerLogin />} />
        <Route
          element={
            <DealerProtectedRoute>
              <DealerShell />
            </DealerProtectedRoute>
          }
        >
          <Route index element={<Navigate to="listings" replace />} />
          <Route path="listings" element={<DealerListings />} />
          <Route path="listings/:id/slots" element={<DealerListingSlots />} />
          <Route path="listings/:id/live" element={<DealerListingLive />} />
          <Route path="bookings" element={<DealerBookings />} />
          <Route path="employees" element={<DealerEmployees />} />
          <Route path="history" element={<DealerHistory />} />
        </Route>
      </Routes>
    </DealerAuthProvider>
  );
}
