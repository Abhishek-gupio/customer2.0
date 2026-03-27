import * as React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  LogOut,
  PanelLeftClose,
  Ticket,
  CarFront,
  AlertTriangle,
  X
} from 'lucide-react';
import { cn } from '../lib/cn';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import ShinyText from './ui/ShinyText/ShinyText';
import Particles from './Particles/Particles';

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
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

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
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    navigate('/login');
  };

  const renderNavContent = (isMobile = false) => {
    const isCollapsed = isMobile ? false : sidebarCollapsed;

    return (
      <div className="flex h-full flex-col bg-[#050505] p-3">
        {/* Sidebar Header */}
        <div className="flex items-center justify-between pb-6 pt-3 px-3">
          <div className={cn(
            "flex flex-col pt-1 transition-all duration-300 origin-left overflow-hidden",
            isCollapsed ? "max-w-0 opacity-0 -translate-x-4" : "max-w-[200px] opacity-100 translate-x-0"
          )}>
            <div className="text-[13px] text-[#a1a1aa] font-medium leading-tight whitespace-nowrap uppercase tracking-wider">Customer</div>
            <ShinyText 
              text="Admin Dashboard" 
              disabled={false} 
              speed={3} 
              className="text-[19px] font-extrabold text-white tracking-tight mt-0.5 whitespace-nowrap"
            />
          </div>
          {!isMobile && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={cn(
                "flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded-md border border-white/10 hover:bg-white/10 transition-all duration-300",
                isCollapsed ? "bg-white/5 translate-x-0" : "bg-transparent translate-x-0"
              )}
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              <div className="transition-transform duration-500 ease-out" style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <PanelLeftClose className="h-[14px] w-[14px] text-white" />
              </div>
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1.5 pt-2">
          {navItems
            .filter((item) => !admin || (item.roles as string[]).includes(admin.role))
            .map((item) => {
            const Icon = item.icon;
            const sourceContext = location.state?.sourceContext;
            const isActive = sourceContext 
              ? item.to === `/${sourceContext}`
              : (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to));

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
                  isCollapsed ? "justify-center px-0" : "px-4"
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
                  isCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]"
                )} />

                <span className={cn(
                  "text-[14px] transition-all duration-300 z-10 text-white tracking-[0.01em] whitespace-nowrap overflow-hidden",
                  isCollapsed ? "max-w-0 opacity-0 translate-x-2" : "max-w-[200px] opacity-100 translate-x-0",
                  isActive ? "font-semibold" : "font-medium"
                )}>
                  {item.label}
                </span>

                {/* Tooltip for Collapsed Sidebar */}
                {isCollapsed && (
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
            "relative z-10 rounded-2xl border transition-all duration-500 overflow-hidden",
            isCollapsed 
              ? "border-transparent bg-transparent p-0" 
              : "border-white/[0.08] bg-[#0c0c0c] p-4 shadow-xl"
          )}>
            {/* Expanded Content (Fades Out) */}
            <div className={cn(
              "transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
              isCollapsed ? "max-h-0 opacity-0 scale-95 pointer-events-none" : "max-h-[300px] opacity-100 scale-100"
            )}>
              <div className="text-[13px] font-normal text-[#a1a1aa] whitespace-nowrap">Signed in as</div>
              <div className="mt-1 truncate text-[15px] font-bold text-white tracking-tight">{admin?.email || 'admin@example.com'}</div>

              <div className="mt-3">
                <span className="inline-flex h-[24px] items-center rounded-lg bg-white/5 px-2.5 text-[11px] font-bold tracking-wide text-white/50 border border-white/5 uppercase">
                  {admin?.role || 'SUPER ADMIN'}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="mt-6 flex h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-white/[0.03] border border-white/5 text-[14px] font-bold text-white hover:bg-white/[0.08] transition-all active:scale-[0.98] group/btn"
              >
                <LogOut className="h-[18px] w-[18px] text-white/40 group-hover/btn:text-white transition-colors" />
                <span>Logout</span>
              </button>
            </div>

            {/* Collapsed Content (Fades In) */}
            <div className={cn(
              "flex justify-center transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
              isCollapsed ? "opacity-100 scale-100 h-[44px]" : "opacity-0 scale-75 h-0 pointer-events-none"
            )}>
              <button
                onClick={handleLogout}
                className="group relative flex h-[44px] w-[44px] items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 text-white hover:bg-white/[0.08] transition-all hover:scale-105"
              >
                <LogOut className="h-[18px] w-[18px] text-white/40 group-hover:text-white transition-colors" />

                {/* Tooltip for Logout */}
                <div className="absolute left-[calc(100%+16px)] hidden group-hover:flex items-center z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="relative rounded-[8px] bg-[#0c0c0c] border border-white/10 px-3 py-2.5 shadow-2xl flex items-center shadow-black/50">
                    <span className="text-[12px] font-semibold text-[#e4e4e7] whitespace-nowrap leading-none tracking-wide">Logout</span>
                    <div className="absolute -left-[5px] top-[50%] -translate-y-1/2 h-[10px] w-[10px] bg-[#0c0c0c] border-l border-t border-white/10 -rotate-45 rounded-sm" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-[#000000] text-[#e4e4e7] antialiased selection:bg-[#00f2ff]/30">
      <div className="mx-auto flex h-full max-w-[1440px]">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex flex-shrink-0 relative z-30 h-full flex-col border-r border-[#ffffff0a] bg-[#050505] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] font-sans",
            sidebarCollapsed ? "w-[80px]" : "w-[280px]"
          )}
        >
          {renderNavContent(false)}
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
            {mobileMenuOpen ? (
              <LayoutDashboard className="h-5 w-5 text-white/40" />
            ) : (
              <LayoutDashboard className="h-5 w-5 text-[#00f2ff]" />
            )}
          </button>
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xl transition-all animate-in fade-in duration-300"
            onClick={() => setMobileMenuOpen(false)}
          >
            <aside
              className="absolute left-0 top-0 h-full w-[85%] max-w-[300px] bg-[#050505] border-r border-white/10 animate-in slide-in-from-left duration-300 shadow-[20px_0_50px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              {renderNavContent(true)}
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main className={cn(
          "flex-1 h-full overflow-hidden flex flex-col bg-[#000000]",
          "pt-[76px] px-3 pb-3 sm:pt-[80px] sm:px-6 sm:pb-6 lg:pt-0 lg:p-10"
        )}>
          <div className="mx-auto w-full max-w-[1600px] flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-700">
            {/* Dynamic Header */}
            <header className="mb-6 lg:flex items-center justify-between hidden">
              <div>
                <h2 className="text-[32px] font-black tracking-tight text-white uppercase leading-none">
                  <ShinyText 
                    text={getPageTitle(location.pathname).title} 
                    disabled={false} 
                    speed={3} 
                  />
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

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-hidden">
          {/* Background Overlay with Particles */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <div className="absolute inset-0 opacity-40">
              <Particles
                particleColors={["#ffffff", "#00f2ff"]}
                particleCount={100}
                particleSpread={10}
                speed={0.1}
                particleBaseSize={80}
                moveParticlesOnHover={false}
                alphaParticles={true}
                disableRotation={false}
              />
            </div>
          </div>

          {/* Modal Card */}
          <div className="relative w-full max-w-[440px] bg-[#0c0c0c]/80 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 ease-out flex flex-col items-center text-center">
            {/* Close Button */}
            <button 
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Warning Icon with Glow */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/20">
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
            </div>

            {/* Content */}
            <h3 className="text-[28px] font-black tracking-tight text-white mb-3">
              Confirm Logout
            </h3>
            <p className="text-[16px] text-zinc-400 font-medium leading-relaxed mb-10 max-w-[280px]">
              Are you sure you want to end your current session?
            </p>

            {/* Actions */}
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={confirmLogout}
                className="group relative flex h-[56px] w-full items-center justify-center overflow-hidden rounded-2xl bg-white font-bold text-black transition-all hover:bg-red-500 hover:text-white active:scale-[0.98]"
              >
                <div className="relative z-10 flex items-center gap-2">
                  <LogOut className="h-5 w-5" />
                  <span>Sign Out</span>
                </div>
              </button>
              
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex h-[56px] w-full items-center justify-center rounded-2xl bg-white/5 border border-white/10 font-bold text-white hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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

