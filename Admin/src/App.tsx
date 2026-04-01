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
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="car-library" element={<VehicleCatalog />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}
