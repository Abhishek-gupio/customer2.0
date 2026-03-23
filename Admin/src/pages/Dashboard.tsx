import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ReceiptIndianRupee, Ticket, Users, CarFront } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';

export default function Dashboard() {
  const { hasRole } = useAuth();
  const [stats, setStats] = useState<{
    customers: number;
    vehicles: number;
    totalExpenses: number;
    expenseCount: number;
    supportTicketsOpen: number;
    weeklyTrend?: { date: string; label: string; customers: number; expenseAmount: number }[];
    databaseAvailable?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canSeeStats = hasRole('SUPER_ADMIN', 'ADMIN');

  const chartData = useMemo(() => {
    const trend = stats?.weeklyTrend ?? [];
    return trend.length
      ? trend.map((d) => ({ name: d.label, customers: d.customers, expenseAmount: d.expenseAmount }))
      : [];
  }, [stats?.weeklyTrend]);

  const weekExpenseTotal = useMemo(
    () => (stats?.weeklyTrend ?? []).reduce((sum, d) => sum + d.expenseAmount, 0),
    [stats?.weeklyTrend]
  );

  useEffect(() => {
    if (!canSeeStats) {
      setLoading(false);
      return;
    }
    let ignore = false;
    adminApi.stats().then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success) setStats(res.data);
      else setError(res.error.message);
    });
    return () => {
      ignore = true;
    };
  }, [canSeeStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-9 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-64" />
            </CardHeader>
            <CardContent className="h-[280px]">
              <Skeleton className="h-full w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-2 h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-[rgba(220,53,69,0.35)] bg-[rgba(220,53,69,0.10)] p-5 text-white">
        <div className="text-sm font-semibold">Something went wrong</div>
        <div className="mt-1 text-sm text-white/70">{error}</div>
      </div>
    );
  }

  if (!canSeeStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Support Dashboard</CardTitle>
          <CardDescription>You have Support role. Use Customers to view tickets and customer info.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="text-sm text-white/60">
            Tip: Search by phone number to quickly locate the customer.
          </div>
          <Button asChild variant="secondary">
            <Link to="/customers">Go to Customers</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {stats && stats.databaseAvailable === false && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Database is temporarily unreachable. Stats below may show zeros. Check your network or database configuration.
        </div>
      )}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-white/60">Production-grade overview of customer app data</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link to="/customers">
              <Users className="h-4 w-4" />
              Customers
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Customers" value={stats?.customers ?? 0} icon={Users} />
        <KpiCard title="Vehicles" value={stats?.vehicles ?? 0} icon={CarFront} />
        <KpiCard
          title="Total expenses (₹)"
          value={stats?.totalExpenses != null ? Number(stats.totalExpenses).toLocaleString('en-IN') : 0}
          icon={ReceiptIndianRupee}
        />
        <KpiCard title="Open tickets" value={stats?.supportTicketsOpen ?? 0} icon={Ticket} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--accent)]" />
              Last 7 days
            </CardTitle>
            <CardDescription>
              New signups and expenses by day. Week total expenses: ₹{weekExpenseTotal.toLocaleString('en-IN')}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="accentFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: 'var(--primary)' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-white/10 bg-[var(--panel)] px-4 py-3 shadow-xl">
                          <div className="text-xs font-medium text-white/70">{label}</div>
                          <div className="mt-1.5 space-y-1 text-sm">
                            <div>Signups: <span className="font-semibold text-[var(--accent)]">{p.customers}</span></div>
                            <div>Expenses: <span className="font-semibold">₹{Number(p.expenseAmount).toLocaleString('en-IN')}</span></div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area type="monotone" dataKey="customers" stroke="var(--accent)" strokeWidth={2} fill="url(#accentFill)" name="customers" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/50">No trend data yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operator checklist</CardTitle>
            <CardDescription>Quick actions for daily ops</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { t: 'Review open tickets', d: 'Prioritize urgent & billing', href: '/customers' },
              { t: 'Spot abnormal expenses', d: 'Look for outliers', href: '/customers' },
              { t: 'Verify recent documents', d: 'Pending → Verified', href: '/customers' },
            ].map((x) => (
              <Link
                key={x.t}
                to={x.href}
                className="block rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
              >
                <div className="text-sm font-semibold">{x.t}</div>
                <div className="mt-1 text-xs text-white/55">{x.d}</div>
              </Link>
            ))}
            <Button asChild variant="secondary" className="w-full">
              <Link to="/customers">Open customers</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--accent-dim)] blur-2xl" />
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-white/50">{title}</div>
            <div className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--accent)]">{value}</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-dim)]">
            <Icon className="h-5 w-5 text-[var(--accent)]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
