import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Shell from './components/Shell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Tickets from './pages/Tickets';
import Vehicles from './pages/Vehicles';
import CinematicSplashScreen from './components/CinematicSplashScreen';
import { AnimatePresence } from 'motion/react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #0b0c10)' }}>
        <span style={{ color: 'var(--accent)' }}>Loading...</span>
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isSplashScreenVisible, setSplashScreenVisible } = useAuth();

  return (
    <>
      <AnimatePresence>
        {isSplashScreenVisible && (
          <CinematicSplashScreen onComplete={() => setSplashScreenVisible(false)} />
        )}
      </AnimatePresence>
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
