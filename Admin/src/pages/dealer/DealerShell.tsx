import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ParkingSquare, LayoutList, CalendarRange, LogOut } from 'lucide-react';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { cn } from '../../lib/cn';

const navItems = [
  { to: '/dealer/listings', label: 'Listings', icon: LayoutList },
  { to: '/dealer/bookings', label: 'Bookings', icon: CalendarRange },
];

export default function DealerShell() {
  const { dealer, logout } = useDealerAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg,#000)] text-white">
      <header className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <ParkingSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold leading-none">Parking Partner Portal</div>
            <div className="mt-1 text-xs text-white/40">{dealer?.ownerName}</div>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
                  isActive ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-white/60 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => {
              logout();
              navigate('/dealer/login');
            }}
            className="ml-2 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
