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
import ErrorBoundary from './components/ErrorBoundary';

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

function PageBoundary({
  boundaryName,
  title,
  children,
}: {
  boundaryName: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      level="feature"
      boundaryName={boundaryName}
      fallbackTitle={`${title} could not render`}
      fallbackMessage="Try reloading this page section. If the issue keeps happening, report it with the correlation id."
      onSoftRefresh={() => {
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
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
      <Route
        path="/login"
        element={
          <PageBoundary boundaryName="admin-login-page" title="Login">
            <Login />
          </PageBoundary>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ErrorBoundary
              level="feature"
              boundaryName="admin-shell"
              fallbackTitle="Admin shell could not recover"
              fallbackMessage="Try restarting this admin session. If the issue keeps happening, report it with the correlation id."
              onSoftRefresh={() => {
                window.location.reload();
              }}
            >
              <Shell />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <PageBoundary boundaryName="admin-dashboard-page" title="Dashboard">
              <Dashboard />
            </PageBoundary>
          }
        />
        <Route
          path="customers"
          element={
            <PageBoundary boundaryName="admin-customers-page" title="Customers">
              <Customers />
            </PageBoundary>
          }
        />
        <Route
          path="customers/:id"
          element={
            <PageBoundary boundaryName="admin-customer-detail-page" title="Customer detail">
              <CustomerDetail />
            </PageBoundary>
          }
        />
        <Route
          path="tickets"
          element={
            <PageBoundary boundaryName="admin-tickets-page" title="Tickets">
              <Tickets />
            </PageBoundary>
          }
        />
        <Route
          path="vehicles"
          element={
            <PageBoundary boundaryName="admin-vehicles-page" title="Vehicles">
              <Vehicles />
            </PageBoundary>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
