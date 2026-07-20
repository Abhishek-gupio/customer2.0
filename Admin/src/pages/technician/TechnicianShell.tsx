import { Outlet, useNavigate } from 'react-router-dom';
import { Wrench, LogOut } from 'lucide-react';
import { useTechnicianAuth } from '../../context/TechnicianAuthContext';

export default function TechnicianShell() {
  const { technician, logout } = useTechnicianAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg,#000)] text-white">
      <header className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold leading-none">My Jobs</div>
            <div className="mt-1 text-xs text-white/40">{technician?.name}</div>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/technician/login');
          }}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white/60 hover:bg-white/5 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
