import { Routes, Route } from 'react-router-dom';
import { DealerAuthProvider } from '../../context/DealerAuthContext';
import { PartnerAuthProvider } from '../../context/PartnerAuthContext';
import { TechnicianAuthProvider } from '../../context/TechnicianAuthContext';
import { EmployeeAuthProvider } from '../../context/EmployeeAuthContext';
import PartnerPortalLogin from './PartnerPortalLogin';

/**
 * Mounted at /partner-portal in App.tsx. Wraps all four field-partner auth
 * providers so the single login screen here can sign in as any of them —
 * the actual dealer/partner/technician/employee shells under /dealer,
 * /partner, /technician, /employee are untouched and keep working from
 * their own bookmarked URLs.
 */
export default function PartnerPortalRoutes() {
  return (
    <DealerAuthProvider>
      <PartnerAuthProvider>
        <TechnicianAuthProvider>
          <EmployeeAuthProvider>
            <Routes>
              <Route path="/" element={<PartnerPortalLogin />} />
            </Routes>
          </EmployeeAuthProvider>
        </TechnicianAuthProvider>
      </PartnerAuthProvider>
    </DealerAuthProvider>
  );
}
