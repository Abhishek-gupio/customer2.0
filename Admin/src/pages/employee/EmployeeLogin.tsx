import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { HardHat, Lock, Phone } from 'lucide-react';
import { useEmployeeAuth } from '../../context/EmployeeAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function EmployeeLogin() {
  const { token, login } = useEmployeeAuth();
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (token) return <Navigate to="/employee/listings" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await login(phoneNumber.trim(), password);
    setSubmitting(false);
    if (res.ok) navigate('/employee/listings');
    else setError(res.error ?? 'Invalid phone number or password');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg,#09090b)] px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--accent)]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      
      <Card className="w-full max-w-[420px] relative z-10 bg-[#18181b]/80 border-white/[0.04] backdrop-blur-2xl shadow-2xl shadow-black/50">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none rounded-xl" />
        <CardHeader className="text-center pt-10 pb-6 relative z-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <HardHat className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight text-white mb-2">Parking Staff Sign-in</CardTitle>
          <CardDescription className="text-white/50 text-sm font-medium">Mark walk-in cars as parked or left</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 px-8 pb-10">
          <form onSubmit={handleSubmit} className="space-y-5 pb-6">
            <div className="relative group">
              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type="tel"
                required
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="h-12 w-full rounded-xl bg-white/[0.02] border border-white/[0.08] pl-11 pr-4 text-sm font-medium text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300"
              />
            </div>
            <div className="relative group">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-xl bg-white/[0.02] border border-white/[0.08] pl-11 pr-4 text-sm font-medium text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300"
              />
            </div>
            {error && <p className="text-sm font-semibold text-red-400 text-center">{error}</p>}
            <Button type="submit" className="w-full h-12 text-sm font-bold mt-2" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in securely'}
            </Button>
          </form>
          <div className="pt-6 border-t border-white/[0.04]">
            <p className="text-center text-[11px] font-bold uppercase tracking-widest text-white/30">
              Your parking lot owner sets up your sign-in details
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
