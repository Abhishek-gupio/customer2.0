import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ReceiptIndianRupee, Ticket, Users, CarFront } from 'lucide-react';
import { Area, AreaChart, Bar, ComposedChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/cn';

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mt-8">
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 pt-2">
        <KPICard
          title="Total Customers"
          value={stats?.customers ?? 0}
          icon={Users}
          trend={calculateTrend(stats?.weeklyTrend || [], 'customers')}
          color="emerald"
          sparklineData={calculateSparkline(stats?.weeklyTrend || [], 'customers')}
          href="/customers"
        />
        <KPICard
          title="Total Vehicles"
          value={stats?.vehicles ?? 0}
          icon={CarFront}
          trend={calculateTrend(stats?.weeklyTrend || [], 'vehicles')}
          sparklineData={calculateSparkline(stats?.weeklyTrend || [], 'vehicles')}
          color="blue"
          subtext="Registered across platform"
          href="/vehicles"
        />
        <KPICard
          title="Total Expenses"
          value={stats?.totalExpenses ?? 0}
          isCurrency
          icon={ReceiptIndianRupee}
          trend={calculateTrend(stats?.weeklyTrend || [], 'expenseAmount')}
          color="orange"
          sparklineData={calculateSparkline(stats?.weeklyTrend || [], 'expenseAmount')}
          href="/customers"
        />
        <KPICard
          title="Open Tickets"
          value={stats?.supportTicketsOpen ?? 0}
          icon={Ticket}
          trend={{ value: 'Active', isPositive: (stats?.supportTicketsOpen ?? 0) < 10 }}
          color="red"
          subtext={(stats?.supportTicketsOpen ?? 0) > 0 ? "Requires attention" : "No open issues"}
          href="/tickets"
        />
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
              { t: 'Review open tickets', d: 'Prioritize urgent & billing', href: '/tickets' },
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

// --- Enhanced KPI Card Component ---
function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  color,
  isCurrency,
  sparklineData,
  subtext,
  href
}: {
  title: string;
  value: string | number;
  icon: any;
  trend?: { value: string; isPositive: boolean };
  color: 'emerald' | 'blue' | 'orange' | 'red';
  isCurrency?: boolean;
  sparklineData?: any[];
  subtext?: string;
  href: string;
}) {
  const colorMap = {
    emerald: {
      cardBg: 'bg-[#0a0a0a]',
      glowColor: 'rgba(34,197,94,0.15)',
      shadowColor: '#22c55e',
      iconBox: 'border-[#22c55e]/30 text-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.3)]',
      trendPos: 'text-[#22c55e]',
      trendNeg: 'text-[#ef4444]',
    },
    blue: {
      cardBg: 'bg-[#0a0a0a]',
      glowColor: 'rgba(59,130,246,0.15)',
      shadowColor: '#3b82f6',
      iconBox: 'border-[#3b82f6]/30 text-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.3)]',
      trendPos: 'text-[#3b82f6]',
      trendNeg: 'text-[#ef4444]',
    },
    orange: {
      cardBg: 'bg-[#0a0a0a]',
      glowColor: 'rgba(245,158,11,0.15)',
      shadowColor: '#f59e0b',
      iconBox: 'border-[#f59e0b]/30 text-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.3)]',
      trendPos: 'text-[#f59e0b]',
      trendNeg: 'text-[#ef4444]',
    },
    red: {
      cardBg: 'bg-[#0a0a0a]',
      glowColor: 'rgba(239,68,68,0.15)',
      shadowColor: '#ef4444',
      iconBox: 'border-[#ef4444]/30 text-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.3)]',
      trendPos: 'text-[#ef4444]',
      trendNeg: 'text-[#ef4444]',
    },
  };

  const style = colorMap[color];
  const formattedValue = isCurrency ? formatCurrencyShorthand(Number(value)) : value;

  // Provide empty data points to render the chart if none exist yet.
  const displayChartData = sparklineData && sparklineData.length > 0
    ? sparklineData
    : [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }];

  return (
    <Link to={href} className="group block focus:outline-none transition-transform duration-300 hover:scale-[1.02]">
      <div
        className={cn(
          "relative flex flex-col justify-between rounded-[20px] border border-white/[0.06] h-[190px] p-5 overflow-hidden",
          style.cardBg
        )}
        style={{
          boxShadow: `inset 0 15px 35px -20px ${style.glowColor}, 0 10px 30px -15px ${style.glowColor}`
        }}
      >
        <div className="flex gap-4 items-start relative z-10 w-full">
          <div className={cn(
            "flex h-[40px] w-[40px] items-center justify-center rounded-[12px] border bg-[#0a0a0a]/40 shrink-0",
            style.iconBox
          )}>
            <Icon className="h-5 w-5" strokeWidth={2.5} />
          </div>

          <div className="flex flex-col gap-0.5 justify-center mt-0.5 w-full">
            <h3 className="text-[13px] font-bold text-white leading-none">
              {title.replace('Total ', '')}
            </h3>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[22px] font-extrabold tracking-tight text-white leading-none">
                {formattedValue || "0"}
              </span>
              {trend && (
                <span className={cn(
                  "text-[13px] font-bold leading-none tracking-wide",
                  trend.isPositive ? style.trendPos : style.trendNeg
                )}>
                  +{trend.value}{trend.value !== 'Active' ? '%' : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-[#71717a] mt-1 leading-none">
              {subtext || "+0 this week"}
            </p>
          </div>
        </div>

        <div className="w-full border-t border-white/[0.06] my-3.5 relative z-10" />

        <div className="flex items-end justify-between relative z-10 flex-1 gap-2 min-h-0">
          {/* Bottom-left: value + name + subtext */}
          <div className="flex flex-col gap-0.5 z-20 pointer-events-none pb-0.5 shrink-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[17px] font-extrabold text-white leading-none">
                {formattedValue || "0"}
              </span>
              <span className="text-[11px] font-semibold text-white/80 leading-none">
                {title.replace('Total ', '')}
              </span>
            </div>
            <p className="text-[9.5px] text-[#71717a] font-medium leading-none mt-0.5">
              {subtext || "Added recently"}
            </p>
          </div>

          {/* Bottom-right: sparkline chart — absolutely positioned so it can be as tall as needed */}
          <div className="absolute right-[-8px] bottom-[-12px] w-[62%] h-[110px] opacity-90 pointer-events-none z-10">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayChartData} margin={{ top: 6, right: 8, bottom: 10, left: 4 }}>
                <YAxis hide domain={[0, 'dataMax + 2']} padding={{ top: 16, bottom: 0 }} />
                <defs>
                  <linearGradient id={`fill-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={style.shadowColor} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={style.shadowColor} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`bar-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={style.shadowColor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={style.shadowColor} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <Bar
                  dataKey="val"
                  fill={`url(#bar-${color})`}
                  barSize={6}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={1500}
                />
                <Area
                  type="monotone"
                  dataKey="val"
                  stroke="none"
                  fill={`url(#fill-${color})`}
                  isAnimationActive={true}
                  animationDuration={1500}
                />
                <Line
                  type="monotone"
                  dataKey="val"
                  stroke={style.shadowColor}
                  strokeWidth={2}
                  dot={{ r: 2.8, fill: '#0a0a0a', stroke: style.shadowColor, strokeWidth: 1.5 }}
                  isAnimationActive={true}
                  animationDuration={1500}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Link>
  );
}

// --- Helper Functions ---

function formatCurrencyShorthand(val: number) {
  if (isNaN(val)) return '₹0';
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
  return `₹${val.toLocaleString('en-IN')}`;
}

function calculateTrend(trend: any[], key: string) {
  if (trend.length < 2) return { value: '0', isPositive: true };
  const latest = trend[trend.length - 1][key];
  const previous = trend[trend.length - 2][key];
  if (previous === 0) return { value: latest > 0 ? '100' : '0', isPositive: true };
  const diff = ((latest - previous) / previous) * 100;
  return {
    value: Math.abs(diff).toFixed(0),
    isPositive: diff >= 0
  };
}

function calculateSparkline(trend: any[], key: string) {
  return trend.map(d => ({ val: d[key] }));
}
