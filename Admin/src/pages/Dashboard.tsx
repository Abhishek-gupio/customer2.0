import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, ReceiptIndianRupee, Ticket, Users, CarFront, ShieldAlert, Sparkles, ArrowRight, Clock, TrendingUp, Search, Activity, PieChart } from 'lucide-react';
import { Area, Bar, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, AreaChart, Pie, Cell, PieChart as RePieChart } from 'recharts';
import { adminApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/cn';
import CountUp from '../components/ui/CountUp/CountUp';

export default function Dashboard() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<{
    customers: number;
    vehicles: number;
    totalExpenses: number;
    expenseCount: number;
    supportTicketsOpen: number;
    unverifiedVehiclesCount: number;
    totalCustomersToday: number;
    recentHighExpenses: { id: string; amount: number; customer: { fullName: string }; category: string; date: string }[];
    expenseCategoryBreakdown: { category: string; amount: number; count: number }[];
    ticketPriorityDistribution: { priority: string; count: number }[];
    vehicleHealthDistribution: { critical: number; warning: number; good: number };
    trendData?: { date: string; label: string; customers: number; expenseAmount: number; tickets: number; vehicles: number }[];
    databaseAvailable?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRange, setSelectedRange] = useState(7);
  const [isMounted, setIsMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSegment, setActiveSegment] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const canSeeStats = hasRole('SUPER_ADMIN', 'ADMIN');

  const chartData = useMemo(() => {
    const trend = stats?.trendData ?? [];
    return trend.length
      ? trend.map((d) => ({ name: d.label, customers: d.customers, expenseAmount: d.expenseAmount }))
      : [];
  }, [stats?.trendData]);

  const weekExpenseTotal = useMemo(
    () => (stats?.trendData ?? []).reduce((sum, d) => sum + d.expenseAmount, 0),
    [stats?.trendData]
  );

  useEffect(() => {
    if (!canSeeStats) {
      setLoading(false);
      return;
    }
    let ignore = false;
    setLoading(true);
    adminApi.stats(selectedRange).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success) setStats(res.data);
      else setError(res.error.message);
    });
    return () => {
      ignore = true;
    };
  }, [canSeeStats, selectedRange]);

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
    <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2 pb-10">
      {stats && stats.databaseAvailable === false && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Database is temporarily unreachable. Stats below may show zeros. Check your network or database configuration.
        </div>
      )}

      {/* --- DASHBOARD HEADER & QUICK ACTIONS (Local title removed) --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-2">
        <div />
        
        <div className="flex items-center gap-3">
          {/* Action buttons removed per request */}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 pt-2">
        <KPICard
          title="Total Customers"
          value={stats?.customers ?? 0}
          icon={Users}
          trend={calculateTrend(stats?.trendData || [], 'customers')}
          color="emerald"
          sparklineData={calculateSparkline(stats?.trendData || [], 'customers')}
          subtext={calculatePeriodSubtext(stats?.trendData || [], 'customers', selectedRange)}
          href="/customers"
        />
        <KPICard
          title="Total Vehicles"
          value={stats?.vehicles ?? 0}
          icon={CarFront}
          trend={calculateTrend(stats?.trendData || [], 'vehicles')}
          sparklineData={calculateSparkline(stats?.trendData || [], 'vehicles')}
          color="blue"
          subtext={calculatePeriodSubtext(stats?.trendData || [], 'vehicles', selectedRange)}
          href="/vehicles"
        />
        <KPICard
          title="Total Expenses"
          value={stats?.totalExpenses ?? 0}
          isCurrency
          icon={ReceiptIndianRupee}
          trend={calculateTrend(stats?.trendData || [], 'expenseAmount')}
          color="orange"
          sparklineData={calculateSparkline(stats?.trendData || [], 'expenseAmount')}
          subtext={calculatePeriodSubtext(stats?.trendData || [], 'expenseAmount', selectedRange, true)}
          href="/customers"
        />
        <KPICard
          title="Open Tickets"
          value={stats?.supportTicketsOpen ?? 0}
          icon={Ticket}
          trend={calculateTrend(stats?.trendData || [], 'tickets')}
          color="red"
          sparklineData={calculateSparkline(stats?.trendData || [], 'tickets')}
          subtext={calculatePeriodSubtext(stats?.trendData || [], 'tickets', selectedRange)}
          href="/tickets"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[var(--accent)]" />
                Trends Analysis
              </CardTitle>
              <CardDescription>
                Growth and behavior over the last {selectedRange} days. 
                Total expenses: ₹{weekExpenseTotal.toLocaleString('en-IN')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-white/[0.03] p-1.5 border border-white/[0.06] shadow-inner">
              {[7, 30, 90].map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRange(r)}
                  className={cn(
                    "px-4 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all duration-300 rounded-xl relative overflow-hidden",
                    selectedRange === r 
                      ? "bg-white text-[#0a0a0a] shadow-[0_4px_12px_rgba(255,255,255,0.2)] scale-105 active:scale-95" 
                      : "text-white/30 hover:text-white/60 hover:bg-white/5"
                  )}
                >
                  {r === 7 ? '7 Days' : r === 30 ? '30 Days' : '90 Days'}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="h-[320px] pt-4">
            {isMounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 500 }} 
                    axisLine={false} 
                    tickLine={false} 
                    dy={10}
                    interval={selectedRange > 30 ? 10 : selectedRange > 7 ? 2 : 0}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fill: 'var(--accent)', fontSize: 11, fontWeight: 600 }} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(val) => Math.floor(val) === val ? val : ''}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: '#f59e0b', fontSize: 10, fontWeight: 500 }} 
                    axisLine={false} 
                    tickLine={false}
                    tickFormatter={(val) => `₹${formatCurrencyShorthand(val).replace('₹', '')}`}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const signups = payload.find(p => p.dataKey === 'customers')?.value || 0;
                      const expenses = payload.find(p => p.dataKey === 'expenseAmount')?.value || 0;
                      return (
                        <div className="rounded-2xl border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-md px-4 py-3 shadow-2xl min-w-[160px]">
                          <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest border-b border-white/5 pb-2 mb-2">{label}</div>
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                                <span className="text-xs font-medium text-white/70">New Signups</span>
                              </div>
                              <span className="text-sm font-black text-white">{signups}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                                <span className="text-xs font-medium text-white/70">Expenses</span>
                              </div>
                              <span className="text-sm font-black text-white">₹{Number(expenses).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    height={36} 
                    iconType="circle" 
                    formatter={(value) => <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{value === 'customers' ? 'Signups' : 'Expenses'}</span>}
                  />
                  <Area 
                    yAxisId="left"
                    name="customers"
                    type="monotone" 
                    dataKey="customers" 
                    stroke="var(--accent)" 
                    strokeWidth={3} 
                    fill="url(#signupGradient)" 
                    animationDuration={1500}
                    dot={selectedRange > 30 ? false : { r: 3, fill: 'var(--accent)', stroke: '#0a0a0a', strokeWidth: 1.5, fillOpacity: 1 }}
                    activeDot={{ r: 5, fill: 'var(--accent)', stroke: 'white', strokeWidth: 2 }}
                  />
                  <Bar 
                    yAxisId="right"
                    dataKey="expenseAmount" 
                    fill="url(#expenseGradient)" 
                    radius={[4, 4, 0, 0]} 
                    barSize={selectedRange > 7 ? 8 : 20}
                    animationDuration={2000}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/50">No trend data yet</div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-none bg-[#0a0a0a] shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-transparent opacity-50" />
          <CardHeader className="relative z-10 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold">Action Center</CardTitle>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <CardDescription>Real-time tasks & insights</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4 pt-2">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all hover:bg-white/[0.05]">
                <div className="flex items-center gap-2 text-[#71717a]">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Unverified</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-white">
                    <CountUp 
                      to={stats?.unverifiedVehiclesCount ?? 0} 
                      duration={1} 
                      formatter={(val) => Math.floor(val) >= 1000 ? `${(val/1000).toFixed(1)}k` : Math.floor(val).toString()}
                    />
                  </span>
                  <span className="text-[10px] text-white/50 font-medium">Vehicles</span>
                </div>
                <Link to="/vehicles" className="absolute inset-0 outline-none" />
              </div>

              <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all hover:bg-white/[0.05]">
                <div className="flex items-center gap-2 text-[#71717a]">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Today</span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-black text-white">
                    +<CountUp 
                      to={stats?.totalCustomersToday ?? 0} 
                      duration={1} 
                      formatter={(val) => Math.floor(val) >= 1000 ? `${(val/1000).toFixed(1)}k` : Math.floor(val).toString()}
                    />
                  </span>
                  <span className="text-[10px] text-white/50 font-medium">New Customers</span>
                </div>
                <Link to="/customers" className="absolute inset-0 outline-none" />
              </div>
            </div>

            {/* High Expenses Scan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Recent High Expenses</span>
                <Clock className="h-3 w-3 text-white/20" />
              </div>
              <div className="space-y-2">
                {stats?.recentHighExpenses && stats.recentHighExpenses.length > 0 ? (
                  stats.recentHighExpenses.map((exp) => (
                    <Link
                      key={exp.id}
                      to={`/customers`} 
                      className="group flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.01] p-2.5 transition hover:bg-white/[0.04] hover:border-white/[0.08]"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="truncate text-xs font-semibold text-white/90 group-hover:text-[var(--accent)]">
                          {exp.customer?.fullName || 'Unknown Customer'}
                        </span>
                        <span className="text-[10px] text-white/40">
                          {new Date(exp.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-white">₹{exp.amount.toLocaleString('en-IN')}</div>
                        <div className="text-[9px] uppercase font-bold text-white/30 tracking-tighter">Verified</div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-white/30">
                    No high expenses recently
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* EXPENSE CATEGORY ANALYSIS */}
        <Card className="xl:col-span-1 border-none bg-gradient-to-b from-white/[0.02] to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4 text-orange-400" />
              Expense Distribution
            </CardTitle>
            <CardDescription>Breakdown by major categories</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px] relative">
            {stats?.expenseCategoryBreakdown && stats.expenseCategoryBreakdown.length > 0 ? (
              <div className="h-full w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={stats.expenseCategoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={105}
                      paddingAngle={8}
                      dataKey="amount"
                      onMouseEnter={(_, index) => setActiveSegment(stats.expenseCategoryBreakdown[index])}
                      onMouseLeave={() => setActiveSegment(null)}
                    >
                      {stats.expenseCategoryBreakdown.map((entry, index) => {
                        const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="none" />;
                      })}
                    </Pie>
                    <Tooltip content={() => null} />
                  </RePieChart>
                </ResponsiveContainer>

                {/* Fixed "Box" in the corner for hovered data */}
                <div className={cn(
                  "absolute top-0 right-0 p-3 rounded-2xl border border-white/10 bg-[#0c0c0c]/80 backdrop-blur-md transition-all duration-300 z-20",
                  activeSegment ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
                )}>
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">{activeSegment?.category}</div>
                  <div className="text-lg font-black text-white">₹{activeSegment?.amount?.toLocaleString('en-IN')}</div>
                </div>

                {/* Centered Total Indicator */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-10 text-center">
                   <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">Total</div>
                   <div className="text-2xl font-black text-white leading-none">₹{(stats?.totalExpenses || 0).toLocaleString('en-IN')}</div>
                   <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                      <div className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Live Flow</span>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/30">No categorical data</div>
            )}
          </CardContent>
        </Card>

        {/* VEHICLE HEALTH MONITOR */}
        <Card className="xl:col-span-1 border-none bg-gradient-to-b from-white/[0.02] to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-emerald-400" />
              Vehicle Health
            </CardTitle>
            <CardDescription>Status of currently monitored fleet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-1 gap-2">
                <HealthStatusRow 
                   label="Critical Condition" 
                   count={stats?.vehicleHealthDistribution?.critical || 0} 
                   color="bg-red-500" 
                   iconColor="text-red-400" 
                />
                <HealthStatusRow 
                   label="Maintenance Required" 
                   count={stats?.vehicleHealthDistribution?.warning || 0} 
                   color="bg-amber-500" 
                   iconColor="text-amber-400" 
                />
                <HealthStatusRow 
                   label="Good Status" 
                   count={stats?.vehicleHealthDistribution?.good || 0} 
                   color="bg-emerald-500" 
                   iconColor="text-emerald-400" 
                />
             </div>
             
             <div className="pt-2">
                <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3 px-1 flex items-center justify-between">
                  <span>Priority Support Tickets</span>
                  <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px]">{(stats?.ticketPriorityDistribution || []).find(p => p.priority === 'HIGH')?.count || 0} Critical</span>
                </div>
                <div className="space-y-2">
                   {stats?.ticketPriorityDistribution?.length ? stats.ticketPriorityDistribution.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                         <span className="text-xs font-semibold text-white/70">{p.priority} Priority</span>
                         <span className="text-sm font-black text-white">{p.count}</span>
                      </div>
                   )) : (
                    <div className="text-[10px] text-white/30 text-center py-2">No active tickets</div>
                   )}
                </div>
             </div>
          </CardContent>
        </Card>

        {/* RECENT HIGH REVENUE/EXPENSE FEED */}
        <Card className="xl:col-span-1 border-none bg-gradient-to-b from-white/[0.02] to-transparent">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              Growth Summary
            </CardTitle>
            <CardDescription>Activity in the current period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
             <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between group hover:bg-white/[0.05] transition-colors">
                <div>
                   <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">New Signups Today</div>
                   <div className="text-2xl font-black text-white mt-0.5">+{stats?.totalCustomersToday || 0}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                   <Users className="h-5 w-5" />
                </div>
             </div>
             <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between group hover:bg-white/[0.05] transition-colors">
                <div>
                   <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Pending Verification</div>
                   <div className="text-2xl font-black text-white mt-0.5">{stats?.unverifiedVehiclesCount || 0}</div>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                   <ShieldAlert className="h-5 w-5" />
                </div>
             </div>
             
             <button 
               onClick={() => {
                 let iframe = document.getElementById('report-iframe') as HTMLIFrameElement;
                 if (!iframe) {
                   iframe = document.createElement('iframe');
                   iframe.id = 'report-iframe';
                   iframe.style.display = 'none';
                   document.body.appendChild(iframe);
                 }
                 
                 const html = `
                   <html>
                     <head>
                       <title>Gupio Dashboard Report</title>
                       <style>
                         @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                         body { font-family: 'Inter', sans-serif; background: #fff; color: #000; padding: 40px; margin: 0; }
                         .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; margin-bottom: 30px; }
                         .logo { height: 40px; }
                         .title { font-size: 24px; font-weight: 900; color: #000; text-transform: uppercase; margin: 0; }
                         .meta { color: #666; font-size: 13px; margin-top: 5px; }
                         .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px; }
                         .card { border: 1px solid #e0e0e0; border-radius: 12px; padding: 15px; }
                         .card-label { font-size: 9px; font-weight: 700; color: #999; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 5px; }
                         .card-value { font-size: 20px; font-weight: 900; color: #000; }
                         .section-title { font-size: 14px; font-weight: 900; color: #000; text-transform: uppercase; margin: 25px 0 12px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 5px; }
                         .table { width: 100%; border-collapse: collapse; }
                         .table th { text-align: left; font-size: 11px; color: #999; text-transform: uppercase; padding: 8px; border-bottom: 1px solid #f0f0f0; }
                         .table td { padding: 8px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
                         .footer { margin-top: 40px; text-align: center; color: #ccc; font-size: 9px; border-top: 1px solid #f0f0f0; padding-top: 15px; }
                       </style>
                     </head>
                     <body>
                       <div class="header">
                         <div>
                           <h1 class="title">Admin Dashboard Report</h1>
                           <div class="meta">Analysis Period: <strong>${selectedRange} Days</strong> | Date: ${new Date().toLocaleDateString()}</div>
                         </div>
                         <img src="/src/assets/images/logo.png" class="logo" />
                       </div>

                       <div class="grid">
                         <div class="card">
                           <div class="card-label">Total Customers</div>
                           <div class="card-value">${stats?.customers}</div>
                         </div>
                         <div class="card">
                           <div class="card-label">Active Fleet</div>
                           <div class="card-value">${stats?.vehicles}</div>
                         </div>
                         <div class="card">
                           <div class="card-label">Total Operating Expenses</div>
                           <div class="card-value">₹${stats?.totalExpenses?.toLocaleString('en-IN')}</div>
                         </div>
                         <div class="card">
                           <div class="card-label">Support Tickets</div>
                           <div class="card-value">${stats?.supportTicketsOpen} Open</div>
                         </div>
                       </div>

                       <h2 class="section-title">Fleet Health Summary</h2>
                       <div class="grid" style="grid-template-columns: repeat(3, 1fr);">
                         <div class="card" style="border-left: 4px solid #ef4444;">
                           <div class="card-label">Critical</div>
                           <div class="card-value">${stats?.vehicleHealthDistribution?.critical || 0}</div>
                         </div>
                         <div class="card" style="border-left: 4px solid #f59e0b;">
                           <div class="card-label">Warning</div>
                           <div class="card-value">${stats?.vehicleHealthDistribution?.warning || 0}</div>
                         </div>
                         <div class="card" style="border-left: 4px solid #10b981;">
                           <div class="card-label">Good</div>
                           <div class="card-value">${stats?.vehicleHealthDistribution?.good || 0}</div>
                         </div>
                       </div>

                       <h2 class="section-title">Operating Costs Breakdown</h2>
                       <table class="table">
                         <thead>
                           <tr>
                             <th>Expense Category</th>
                             <th>Records</th>
                             <th>Total Amount</th>
                           </tr>
                         </thead>
                         <tbody>
                           ${(stats?.expenseCategoryBreakdown || []).map(cat => `
                             <tr>
                               <td><strong>${cat.category}</strong></td>
                               <td>${cat.count}</td>
                               <td>₹${cat.amount.toLocaleString('en-IN')}</td>
                             </tr>
                           `).join('')}
                         </tbody>
                       </table>

                       <div class="footer">
                         Generated by Gupio Admin Terminal. This document contains confidential operational data.
                       </div>
                     </body>
                   </html>
                 `;

                 const doc = iframe.contentWindow?.document || iframe.contentDocument;
                 if (doc) {
                   doc.open();
                   doc.write(html);
                   doc.close();
                   setTimeout(() => {
                     iframe.contentWindow?.focus();
                     iframe.contentWindow?.print();
                   }, 1000);
                 }
               }}
               className="w-full mt-2 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold text-white/60 hover:text-white transition-all active:scale-[0.98]"
             >
                Download Full Report
             </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HealthStatusRow({ label, count, color, iconColor }: { label: string; count: number; color: string; iconColor: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] group hover:bg-white/[0.04] transition-all">
      <div className="flex items-center gap-3">
        <div className={cn("h-2 w-2 rounded-full", color)} />
        <span className="text-xs font-semibold text-white/80">{label}</span>
      </div>
      <span className={cn("text-sm font-black", iconColor)}>{count}</span>
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formatValueWithShorthand = (val: number) => {
    if (isNaN(val)) return '0';
    if (val >= 100000) return `${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return Math.floor(val).toLocaleString('en-IN');
  };

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

  // Provide empty data points to render the chart if none exist yet.
  const displayChartData = useMemo(() => {
    if (!sparklineData || sparklineData.length === 0) {
      return [{ val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }, { val: 0 }];
    }
    // For 90D, the sparkline is too crowded. We take every Nth point or just show the last 30.
    if (sparklineData.length > 30) {
      return sparklineData.filter((_, i) => i % 3 === 0);
    }
    return sparklineData;
  }, [sparklineData]);

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
                {isCurrency && "₹"}
                <CountUp 
                  to={Number(value)} 
                  separator="," 
                  duration={1} 
                  startWhen={true}
                  formatter={formatValueWithShorthand}
                />
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
                {isCurrency && "₹"}
                <CountUp 
                  to={Number(value)} 
                  separator="," 
                  duration={1} 
                  startWhen={true}
                  formatter={formatValueWithShorthand}
                />
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
          <div className="absolute right-[-8px] bottom-[-12px] w-[62%] h-[110px] opacity-90 pointer-events-none z-10 min-h-0 min-w-0">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
              <AreaChart data={displayChartData} margin={{ top: 6, right: 8, bottom: 10, left: 4 }}>
                <YAxis hide domain={[0, 'dataMax + 2']} padding={{ top: 16, bottom: 0 }} />
                <defs>
                  <linearGradient id={`grad-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={style.shadowColor} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={style.shadowColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="val"
                  stroke={style.shadowColor}
                  strokeWidth={2}
                  fill={`url(#grad-${title.replace(/\s+/g, '')})`}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
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
  const latest = trend[trend.length - 1][key] || 0;
  const previous = trend[trend.length - 2][key] || 0;
  
  if (previous === 0) {
    return { value: latest > 0 ? '100' : '0', isPositive: true };
  }
  
  const diff = ((latest - previous) / previous) * 100;
  return {
    value: Math.abs(diff).toFixed(0),
    isPositive: diff >= 0
  };
}

function calculatePeriodSubtext(trend: any[], key: string, days: number, isCurrency: boolean = false) {
  const total = trend.reduce((sum, d) => sum + (d[key] || 0), 0);
  const period = days === 7 ? 'this week' : days === 30 ? 'this month' : 'last 90 days';
  const formatted = isCurrency ? formatCurrencyShorthand(total) : `+${total}`;
  return `${formatted} ${period}`;
}

function calculateSparkline(trend: any[], key: string) {
  return trend.map(d => ({ val: d[key] }));
}
