import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Wrench, Lock, Phone } from 'lucide-react';
import { useTechnicianAuth } from '../../context/TechnicianAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function TechnicianLogin() {
  const { token, login } = useTechnicianAuth();
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (token) return <Navigate to="/technician/jobs" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await login(phoneNumber.trim(), password);
    setSubmitting(false);
    if (res.ok) navigate('/technician/jobs');
    else setError(res.error ?? 'Invalid phone number or password');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg,#000)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pt-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
            <Wrench className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl">Technician Sign-in</CardTitle>
          <CardDescription>See your assigned jobs and update their status</CardDescription>
        </CardHeader>
        <CardContent>
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
            Your wash partner sets up your sign-in details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
