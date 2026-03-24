import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';

export default function Login() {
  const { token, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (token && !loading) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await login(email.trim(), password);
    setSubmitting(false);
    if (res.ok) navigate('/', { replace: true });
    else setError(res.error ?? 'Login failed');
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 selection:bg-white selection:text-black">
      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        
        {/* Left Aspect: Branding & Features */}
        <div className="hidden lg:flex flex-col justify-center p-12 bg-[#0c0c0e] border border-white/[0.05] rounded-[2.5rem] shadow-[0_32px_128px_-32px_rgba(0,0,0,1)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl -mr-32 -mt-32 transition-all group-hover:bg-white/[0.04] duration-1000" />
          
          <div className="relative z-10">
            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30 mb-4 block">Customer</span>
            <h1 className="text-6xl font-black text-white tracking-tighter leading-[0.9] mb-8">
              Admin<br/>Dashboard
            </h1>
            <p className="text-[14px] leading-relaxed text-white/40 max-w-sm mb-12 font-medium">
              Modern operations panel for your app — customers, vehicles, documents, expenses and support, with role-based access.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {[
                { title: 'Realtime overview', icon: '•' },
                { title: 'Powerful search', icon: '•' },
                { title: 'Role based access', icon: '•' },
                { title: 'Audit friendly UX', icon: '•' }
              ].map((f) => (
                <div key={f.title} className="p-6 bg-white/[0.03] border border-white/[0.05] rounded-[1.8rem] hover:bg-white/[0.05] transition-all duration-300 group/feature">
                  <div className="text-white/20 text-xs mb-4 group-hover/feature:text-white transition-colors">●</div>
                  <div className="text-[13px] font-bold text-white/70 group-hover/feature:text-white transition-colors leading-tight">{f.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Aspect: Authentication */}
        <div className="bg-[#0c0c0e] border border-white/[0.05] rounded-[2.5rem] p-8 sm:p-12 shadow-[0_32px_128px_-32px_rgba(0,0,0,1)] flex flex-col justify-center relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/[0.02] rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
          
          <div className="relative z-10">
            <div className="mb-10">
              <h2 className="text-3xl font-black text-white tracking-tight mb-2">Sign in</h2>
              <p className="text-[13px] text-white/30 font-medium">Use your admin email and password</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-4">Email</label>
                <input
                  type="email"
                  placeholder="support@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] px-6 text-sm text-white placeholder:text-white/10 outline-none focus:bg-white/[0.05] focus:border-white/20 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-4">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] px-6 text-sm text-white placeholder:text-white/10 outline-none focus:bg-white/[0.05] focus:border-white/20 transition-all font-medium"
                />
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] font-bold text-red-500 animate-in fade-in slide-in-from-top-2 duration-300">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                disabled={submitting}
                className={cn(
                  "w-full h-14 rounded-2xl bg-white text-black hover:bg-[#e0e0e0] active:scale-[0.98] transition-all font-black uppercase tracking-widest text-[12px] shadow-[0_20px_40px_-10px_rgba(255,255,255,0.15)]",
                  submitting && "opacity-50"
                )}
              >
                {submitting ? 'Authenticating...' : 'Sign in'}
              </Button>

              <div className="pt-6 flex flex-col items-center border-t border-white/[0.05]">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/10">Premium monochrome theme</span>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
