import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { HardHat, ParkingSquare, CalendarRange, LogOut, History } from 'lucide-react';
import { useEmployeeAuth } from '../../context/EmployeeAuthContext';
import { cn } from '../../lib/cn';

const navItems = [
  { to: '/employee/listings', label: 'My Lots', icon: ParkingSquare },
  { to: '/employee/bookings', label: 'Online Bookings', icon: CalendarRange },
  { to: '/employee/history', label: 'History', icon: History },
];

export default function EmployeeShell() {
  const { employee, logout } = useEmployeeAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg,#09090b)] text-white">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.04] bg-black/40 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <HardHat className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold leading-none tracking-tight">Parking Staff</div>
            <div className="mt-1 text-xs font-medium text-white/50">{employee?.name}</div>
          </div>
        </div>
        <nav className="flex items-center gap-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 group',
                  isActive 
                    ? 'bg-white/10 text-white shadow-sm' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("h-4 w-4 transition-colors group-hover:text-[var(--accent)]", isActive ? 'text-[var(--accent)]' : '')} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          <div className="mx-2 h-6 w-px bg-white/10"></div>
          <button
            onClick={() => {
              logout();
              navigate('/employee/login');
            }}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white/50 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
