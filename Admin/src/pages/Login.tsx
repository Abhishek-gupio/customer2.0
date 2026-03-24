import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

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
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-10%,var(--accent-dim),transparent_60%),radial-gradient(900px_500px_at_0%_80%,rgba(255,255,255,0.05),transparent_60%)] px-5 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1100px] items-center">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="hidden lg:block">
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-8">
              <div className="text-sm font-semibold text-white/70">Customer</div>
              <div className="mt-2 text-4xl font-extrabold tracking-tight">
                Admin <span className="text-[var(--accent)]">Dashboard</span>
              </div>
              <p className="mt-4 text-white/60">
                Modern operations panel for your app — customers, vehicles, documents, expenses and support, with role-based access.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-4">
                {['Realtime overview', 'Powerful search', 'Role based access', 'Audit friendly UX'].map((t) => (
                  <div key={t} className="rounded-2xl border border-white/[0.07] bg-[var(--panel-2)] p-4 text-sm text-white/70">
                    <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                    <div className="mt-3 font-semibold text-white">{t}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]">
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Use your admin email and password</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white/60">Email</label>
                  <input
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/60">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="mt-2 h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>
                {error && (
                  <div className="rounded-xl border border-[rgba(220,53,69,0.35)] bg-[rgba(220,53,69,0.12)] px-4 py-3 text-sm text-white">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Signing in...' : 'Sign in'}
                </Button>
                <p className="text-center text-xs text-white/40">
                  Premium monochrome theme
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
