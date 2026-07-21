import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ParkingSquare, Droplets, Wrench, HardHat, Lock, Phone } from 'lucide-react';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { usePartnerAuth } from '../../context/PartnerAuthContext';
import { useTechnicianAuth } from '../../context/TechnicianAuthContext';
import { useEmployeeAuth } from '../../context/EmployeeAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

type PortalRole = 'dealer' | 'partner' | 'technician' | 'employee';

const ROLES: { id: PortalRole; label: string; description: string; icon: typeof ParkingSquare; homePath: string }[] = [
  {
    id: 'dealer',
    label: 'Parking Partner',
    description: 'Listings, availability & bookings',
    icon: ParkingSquare,
    homePath: '/dealer/listings',
  },
  {
    id: 'employee',
    label: 'Parking Staff',
    description: 'Mark walk-ins as parked or left',
    icon: HardHat,
    homePath: '/employee/listings',
  },
  {
    id: 'partner',
    label: 'Wash Partner',
    description: 'Centers, technicians & jobs',
    icon: Droplets,
    homePath: '/partner/centers',
  },
  {
    id: 'technician',
    label: 'Wash Technician',
    description: 'Your assigned jobs',
    icon: Wrench,
    homePath: '/technician/jobs',
  },
];

/**
 * Single entry point across our four field-partner logins (parking dealer,
 * parking staff, wash partner, wash technician). Each role still uses its
 * own existing JWT/auth context/shell underneath — this only picks which
 * `login()` to call and where to land afterward, so none of that working
 * code had to change.
 */
export default function PartnerPortalLogin() {
  const dealerAuth = useDealerAuth();
  const partnerAuth = usePartnerAuth();
  const technicianAuth = useTechnicianAuth();
  const employeeAuth = useEmployeeAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<PortalRole>('dealer');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeRole = ROLES.find((r) => r.id === role)!;

  const AUTH_BY_ROLE = { dealer: dealerAuth, partner: partnerAuth, technician: technicianAuth, employee: employeeAuth };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await AUTH_BY_ROLE[role].login(phoneNumber.trim(), password);
    setSubmitting(false);
    if (res.ok) navigate(activeRole.homePath);
    else setError(res.error ?? 'Invalid phone number or password');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg,#000)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pt-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <activeRole.icon className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">Partner Portal</CardTitle>
          <CardDescription>{activeRole.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setRole(r.id);
                  setError('');
                }}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
                  role === r.id
                    ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10 text-white'
                    : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80'
                }`}
              >
                <r.icon className="h-4 w-4" />
                {r.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="tel"
                required
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="h-11 w-full rounded-xl bg-white/[0.05] border border-white/10 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:outline-none"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl bg-white/[0.05] border border-white/10 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:outline-none"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="text-center text-xs text-white/40 pb-2">
            New accounts are set up by the Gupio team.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
