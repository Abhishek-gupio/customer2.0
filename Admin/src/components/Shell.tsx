import * as React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../lib/cn';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] as const },
  { to: '/customers', label: 'Customers', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] as const },
];

export default function Shell() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('admin.sidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('admin.sidebarCollapsed', sidebarCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-white">
      <div
        className={cn(
          'mx-auto grid min-h-screen max-w-[1400px] grid-cols-1 lg:grid-cols-[280px_1fr]',
          sidebarCollapsed && 'lg:grid-cols-[88px_1fr]'
        )}
      >
        <aside className="sticky top-0 hidden h-screen max-h-screen shrink-0 overflow-y-hidden border-r border-white/[0.07] bg-[radial-gradient(1200px_600px_at_20%_-10%,var(--accent-dim),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_18%)] lg:block">
          <div className="flex h-full flex-col overflow-y-hidden p-5">
            <div className="flex items-center justify-between">
              <div className={cn(sidebarCollapsed && 'hidden')}>
                <div className="text-sm font-semibold tracking-wide text-white/80">Customer</div>
                <div className="text-xl font-extrabold tracking-tight">
                  Admin <span className="text-[var(--accent)]">Dashboard</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => setSidebarCollapsed((v) => !v)}
                className={cn('ml-auto', sidebarCollapsed && 'ml-0')}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5 text-white/80" />
                ) : (
                  <PanelLeftClose className="h-5 w-5 text-white/80" />
                )}
              </Button>
            </div>

            <div className="mt-6 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/8 hover:text-white',
                        sidebarCollapsed && 'justify-center px-2',
                        isActive && 'bg-white/[0.08] text-white ring-1 ring-white/[0.1]'
                      )
                    }
                  >
                    <Icon className="h-4 w-4 text-white/60 group-hover:text-white" />
                    <span className={cn(sidebarCollapsed && 'hidden')}>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>

            <div className="mt-auto pt-6">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className={cn(sidebarCollapsed && 'hidden')}>
                  <div className="text-xs text-white/60">Signed in as</div>
                  <div className="mt-1 truncate text-sm font-semibold">{admin?.email}</div>
                  <div className="mt-2 inline-flex items-center rounded-full bg-[var(--accent-dim)] px-2 py-1 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]/30">
                    {admin?.role}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className={cn('mt-4 w-full justify-center', sidebarCollapsed && 'px-0')}
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span className={cn(sidebarCollapsed && 'hidden')}>Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-10 border-b border-white/[0.07] bg-[var(--bg)]/80 backdrop-blur-xl">
            <div className="flex items-center justify-between px-5 py-4 lg:px-8">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[var(--accent-dim)] ring-1 ring-[var(--accent)]/30" />
                <div className="leading-tight">
                  <div className="text-sm font-semibold">Welcome back</div>
                  <div className="text-xs text-white/60">Manage customer app data</div>
                </div>
              </div>
              <div className="hidden items-center gap-2 lg:flex">
                <Button variant="secondary" onClick={() => navigate('/customers')}>
                  <Users className="h-4 w-4" />
                  Customers
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

