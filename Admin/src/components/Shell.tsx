import * as React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Ticket,
  CarFront,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN'], color: 'white' },
  { to: '/customers', label: 'Customers', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN'], color: 'emerald' },
  { to: '/vehicles', label: 'Vehicles', icon: CarFront, roles: ['SUPER_ADMIN', 'ADMIN'], color: 'blue' },
  { to: '/tickets', label: 'Tickets', icon: Ticket, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'], color: 'red' },
];

const colorStyles: Record<string, { glow: string; border: string; bg: string; icon: string }> = {
  white: {
    glow: 'rgba(255,255,255,0.4)',
    border: '#ffffff',
    bg: 'from-white/[0.12]',
    icon: 'text-white'
  },
  emerald: {
    glow: 'rgba(34,197,94,0.4)',
    border: '#22c55e',
    bg: 'from-[#22c55e]/[0.12]',
    icon: 'text-[#22c55e]'
  },
  blue: {
    glow: 'rgba(59,130,246,0.4)',
    border: '#3b82f6',
    bg: 'from-[#3b82f6]/[0.12]',
    icon: 'text-[#3b82f6]'
  },
  red: {
    glow: 'rgba(239,68,68,0.4)',
    border: '#ef4444',
    bg: 'from-[#ef4444]/[0.12]',
    icon: 'text-[#ef4444]'
  }
};

export default function Shell() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('admin.sidebarCollapsed') === '1';
    } catch {
      return false;
    }
  });

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Redirect SUPPORT role to /tickets if they land on /
  React.useEffect(() => {
    if (admin?.role === 'SUPPORT' && location.pathname === '/') {
      navigate('/tickets', { replace: true });
    }
  }, [admin, location.pathname, navigate]);

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

  const navContent = (
    <div className="flex h-full flex-col bg-[#050505] p-3">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-6 pt-3 px-3">
        {!sidebarCollapsed && (
          <div className="animate-in fade-in duration-500 flex flex-col pt-1">
            <div className="text-[13px] text-[#a1a1aa] font-medium leading-tight">Customer</div>
            <div className="text-[19px] font-extrabold text-white tracking-tight mt-0.5">Admin Dashboard</div>
          </div>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            "flex h-[28px] w-[28px] items-center justify-center rounded-md border border-white/10 hover:bg-white/10 transition-colors",
            sidebarCollapsed ? "mx-auto bg-white/5" : "bg-transparent ml-2"
          )}
          title={sidebarCollapsed ? "Expand" : "Collapse"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-[14px] w-[14px] text-white" />
          ) : (
            <PanelLeftClose className="h-[14px] w-[14px] text-white" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 pt-2">
        {navItems
          .filter((item) => !admin || (item.roles as string[]).includes(admin.role))
          .map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          const styles = colorStyles[item.color];

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "group relative flex h-[46px] items-center gap-[14px] transition-all duration-200 rounded-xl",
                isActive
                  ? `bg-gradient-to-r ${styles.bg} to-transparent`
                  : "text-[#e4e4e7] hover:text-white hover:bg-white/[0.03]",
                sidebarCollapsed ? "justify-center px-0" : "px-4"
              )}
            >
              {/* Fade Colored Glow Border */}
              {isActive && (
                <>
                  <div
                    className="pointer-events-none absolute inset-0 rounded-xl ring-1 shadow-[0_0_15px_rgba(0,0,0,0.1),inset_0_0_15px_rgba(0,0,0,0.05)]"
                    style={{
                      boxShadow: `0 0 15px ${styles.glow}25, inset 0 0 15px ${styles.glow}15`,
                      maskImage: 'linear-gradient(to right, white 10%, transparent 90%)',
                      WebkitMaskImage: 'linear-gradient(to right, white 10%, transparent 90%)'
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10"
                    style={{ maskImage: 'linear-gradient(to left, white 20%, transparent 80%)', WebkitMaskImage: 'linear-gradient(to left, white 20%, transparent 80%)' }}
                  />
                  {/* Thick glowing left line */}
                  <div
                    className="absolute -left-[1px] top-[15%] bottom-[15%] w-[2px] rounded-r-full"
                    style={{
                      backgroundColor: styles.border,
                      boxShadow: `0 0 10px 2px ${styles.border}80`
                    }}
                  />
                </>
              )}

              <Icon className={cn(
                "transition-colors duration-200 z-10",
                isActive ? styles.icon : "text-white/80 group-hover:text-white",
                sidebarCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]"
              )} />

              <span className={cn(
                "text-[14px] transition-all duration-300 z-10 text-white tracking-[0.01em]",
                sidebarCollapsed && "opacity-0 invisible absolute translate-x-4",
                isActive ? "font-semibold" : "font-medium"
              )}>
                {item.label}
              </span>

              {/* Tooltip for Collapsed Sidebar */}
              {sidebarCollapsed && (
                <div className="absolute left-[calc(100%+16px)] hidden group-hover:flex items-center z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="relative rounded-[8px] bg-[#0c0c0c] border border-white/10 px-3 py-2.5 shadow-2xl flex items-center shadow-black/50">
                    <span className="text-[12px] font-semibold text-[#e4e4e7] whitespace-nowrap leading-none tracking-wide text-shadow-sm">{item.label}</span>
                    <div className="absolute -left-[5px] top-[50%] -translate-y-1/2 h-[10px] w-[10px] bg-[#0c0c0c] border-l border-t border-white/10 -rotate-45 rounded-sm" />
                  </div>
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Profile Section */}
      <div className="relative mt-auto pt-4 pb-2">
        {/* Subtle cyan glow behind the card on the bottom-left */}
        <div className="absolute -left-6 bottom-0 h-40 w-24 rounded-full bg-[#00f2ff]/15 blur-[35px] pointer-events-none -z-10" />

        <div className={cn(
          "relative z-10 rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-4 transition-all duration-300 overflow-hidden",
          sidebarCollapsed && "border-0 bg-transparent p-0 flex justify-center"
        )}>
          {!sidebarCollapsed && (
            <div className="animate-in fade-in duration-700">
              <div className="text-[13px] font-normal text-[#a1a1aa]">Signed in as</div>
              <div className="mt-1 truncate text-[15px] font-bold text-white tracking-tight">{admin?.email || 'admin@example.com'}</div>

              <div className="mt-2.5">
                <span className="inline-flex h-[24px] items-center rounded-md bg-[#1a1a1a] px-2.5 text-[11px] font-semibold tracking-wide text-[#a1a1aa] border border-white/[0.08]">
                  {admin?.role || 'SUPER ADMIN'}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="mt-5 flex h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-[#111] border border-white/5 text-[14px] font-semibold text-white hover:bg-[#1a1a1a] transition-all active:scale-[0.98]"
              >
                <LogOut className="h-[16px] w-[16px]" />
                <span>Logout</span>
              </button>
            </div>
          )}

          {sidebarCollapsed && (
            <button
              onClick={handleLogout}
              className="group relative flex h-[40px] w-[40px] items-center justify-center rounded-xl bg-[#111] border border-white/5 text-white hover:bg-[#1a1a1a] transition-all"
            >
              <LogOut className="h-[16px] w-[16px]" />

              {/* Tooltip for Logout */}
              <div className="absolute left-[calc(100%+16px)] hidden group-hover:flex items-center z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="relative rounded-[8px] bg-[#0c0c0c] border border-white/10 px-3 py-2.5 shadow-2xl flex items-center shadow-black/50">
                  <span className="text-[12px] font-semibold text-[#e4e4e7] whitespace-nowrap leading-none tracking-wide text-shadow-sm">Logout</span>
                  <div className="absolute -left-[5px] top-[50%] -translate-y-1/2 h-[10px] w-[10px] bg-[#0c0c0c] border-l border-t border-white/10 -rotate-45 rounded-sm" />
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden bg-[#000000] text-[#e4e4e7] antialiased selection:bg-[#00f2ff]/30">
      <div className="mx-auto flex h-full max-w-[1440px]">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex flex-shrink-0 relative z-30 h-full flex-col border-r border-[#ffffff0a] bg-[#050505] transition-all duration-300 ease-in-out font-sans",
            sidebarCollapsed ? "w-[80px]" : "w-[280px]"
          )}
        >
          {navContent}
        </aside>

        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-[64px] flex items-center justify-between px-6 bg-black/80 backdrop-blur-xl border-b border-white/10">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-[#71717a] tracking-wider">Customer</span>
            <span className="text-sm font-bold text-white">Admin Dashboard</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10"
          >
            <LayoutDashboard className="h-5 w-5 text-[#00f2ff]" />
          </button>
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-all animate-in fade-in duration-300"
            onClick={() => setMobileMenuOpen(false)}
          >
            <aside
              className="absolute left-0 top-0 h-full w-[280px] bg-[#050505] border-r border-white/10 animate-in slide-in-from-left duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {navContent}
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden pt-[64px] lg:pt-0 bg-[#000000] custom-scrollbar",
          "p-6 lg:p-10"
        )}>
          <div className="mx-auto max-w-[1600px] animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Dynamic Header */}
            <header className="mb-10 lg:flex items-center justify-between hidden">
              <div>
                <h2 className="text-[32px] font-black tracking-tight text-white uppercase leading-none">
                  {getPageTitle(location.pathname).title}
                </h2>
                <p className="mt-2 text-[14px] text-[#71717a] font-medium">
                  {getPageTitle(location.pathname).sub}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffffff05] border border-[#ffffff10]">
                  <div className="h-2 w-2 rounded-full bg-[#00f2ff] shadow-[0_0_8px_#00f2ff]" />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/customers')}
                  className="bg-white/5 border-[#ffffff0a] hover:bg-white/10 text-white font-bold h-[40px] px-5 transition-all active:scale-[0.98]"
                >
                  <Users className="h-4 w-4 mr-2 text-[#00f2ff]" />
                  Customers
                </Button>
              </div>
            </header>

            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function getPageTitle(pathname: string) {
  switch (pathname) {
    case '/': return { title: 'Dashboard', sub: 'Production-grade overview of customer app data' };
    case '/customers': return { title: 'Customers', sub: 'Manage and view all registered customers' };
    case '/vehicles': return { title: 'Vehicles', sub: 'Fleet management and registration tracking' };
    case '/tickets': return { title: 'Tickets', sub: 'Global support and issue management' };
    default: return { title: 'Admin', sub: 'System Management' };
  }
}

