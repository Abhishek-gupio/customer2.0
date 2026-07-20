import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Shell from './components/Shell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Tickets from './pages/Tickets';
import Vehicles from './pages/Vehicles';
import VehicleCatalog from './pages/VehicleCatalog';
import ExpenseDetail from './pages/ExpenseDetail';
import Expenses from './pages/Expenses';
import ManageAdmins from './pages/ManageAdmins';
import ParkingDealers from './pages/ParkingDealers';
import WashPartners from './pages/WashPartners';
import PaymentsOps from './pages/PaymentsOps';
import Messaging from './pages/Messaging';
import DealerRoutes from './pages/dealer/DealerRoutes';
import PartnerRoutes from './pages/partner/PartnerRoutes';
import TechnicianRoutes from './pages/technician/TechnicianRoutes';
import CinematicSplashScreen from './components/CinematicSplashScreen';
import { AnimatePresence } from 'motion/react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #000000)' }}>
        <span style={{ color: 'var(--accent)' }}>Loading...</span>
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RoleProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode; 
  allowedRoles: ('SUPER_ADMIN' | 'ADMIN' | 'SUPPORT')[] 
}) {
  const { admin, token, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #000000)' }}>
        <span style={{ color: 'var(--accent)' }}>Loading...</span>
      </div>
    );
  }

  if (!token) return <Navigate to="/login" replace />;
  
  if (!admin || !allowedRoles.includes(admin.role)) {
    const redirectPath = admin?.role === 'SUPPORT' ? '/tickets' : '/';
    return <Navigate to={redirectPath} replace />;
  }

  // Special check for Support role and Customers access
  if (admin.role === 'SUPPORT' && (window.location.pathname.startsWith('/customers')) && !admin.canAccessCustomers) {
    return <Navigate to="/tickets" replace />;
  }

  return <>{children}</>;
}



export default function App() {
  const { isSplashScreenVisible, setSplashScreenVisible } = useAuth();

  const handleSplashComplete = React.useCallback(() => {
    setSplashScreenVisible(false);
  }, [setSplashScreenVisible]);

  return (
    <>
      <AnimatePresence>
        {isSplashScreenVisible && (
          <CinematicSplashScreen onComplete={handleSplashComplete} />
        )}
      </AnimatePresence>

      {/* 
        Render Routes behind the splash but keep them invisible 
        to prevent layout flashes or white solid boxes (on mobile) 
        from showing during initial mount.
      */}
      <div style={{
        display: isSplashScreenVisible ? 'none' : 'block',
        opacity: isSplashScreenVisible ? 0 : 1,
        transition: 'opacity 0.5s ease-in-out'
      }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Shell />
              </ProtectedRoute>
            }
          >
            <Route 
              index 
              element={
                <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                  <Dashboard />
                </RoleProtectedRoute>
              } 
            />

            <Route 
              path="customers" 
              element={
                <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'SUPPORT']}>
                  <Customers />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="customers/:id" 
              element={
                <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'SUPPORT']}>
                  <CustomerDetail />
                </RoleProtectedRoute>
              } 
            />

            <Route path="tickets" element={<Tickets />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route 
              path="car-library" 
              element={
                <RoleProtectedRoute allowedRoles={['ADMIN']}>
                  <VehicleCatalog />
                </RoleProtectedRoute>
              } 
            />
            <Route
              path="manage-admins"
              element={
                <RoleProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <ManageAdmins />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="parking-dealers"
              element={
                <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                  <ParkingDealers />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="wash-partners"
              element={
                <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                  <WashPartners />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="payments-ops"
              element={
                <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                  <PaymentsOps />
                </RoleProtectedRoute>
              }
            />
            <Route
              path="messaging"
              element={
                <RoleProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'SUPPORT']}>
                  <Messaging />
                </RoleProtectedRoute>
              }
            />
            <Route path="expenses/:id" element={<ExpenseDetail />} />

            <Route path="expenses" element={<Expenses />} />
          </Route>

          {/* Parking partner (dealer) portal — separate auth from admin, not behind ProtectedRoute/Shell */}
          <Route path="/dealer/*" element={<DealerRoutes />} />

          {/* Wash partner portal — separate auth from admin, not behind ProtectedRoute/Shell */}
          <Route path="/partner/*" element={<PartnerRoutes />} />

          {/* Wash technician portal — separate auth from admin/partner, not behind ProtectedRoute/Shell */}
          <Route path="/technician/*" element={<TechnicianRoutes />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}
