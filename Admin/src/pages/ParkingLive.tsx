import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  MapPin,
  ParkingSquare,
  ChevronLeft,
  ChevronRight,
  Search,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { adminApi, type AdminSearchAnalytics } from '../api/client';
import type { LiveListingSummary, Pagination } from '../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

const PAGE_SIZE = 20;

export default function ParkingLive() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'live' | 'analytics'>('live');

  // Live listings state
  const [listings, setListings] = useState<LiveListingSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search analytics state
  const [analyticsPeriod, setAnalyticsPeriod] = useState(7);
  const [analytics, setAnalytics] = useState<AdminSearchAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'live') {
      setLoading(true);
      adminApi.listParkingLiveListings({ page, limit: PAGE_SIZE }).then((res) => {
        setLoading(false);
        if (res.success) {
          setListings(res.data.data);
          setPagination(res.data.pagination);
        } else setError(res.error.message);
      });
    }
  }, [page, activeTab]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      setAnalyticsLoading(true);
      adminApi.getParkingSearchAnalytics(analyticsPeriod).then((res) => {
        setAnalyticsLoading(false);
        if (res.success) {
          setAnalytics(res.data);
        }
      });
    }
  }, [analyticsPeriod, activeTab]);

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Parking Operations & Search</h1>
          <p className="text-sm text-white/60">Live parking occupancy and customer search demand analytics</p>
        </div>

        <div className="flex items-center rounded-xl border border-white/10 bg-[#18181b] p-1">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'live'
                ? 'bg-emerald-500 text-black shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            Live Status
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-[var(--accent)] text-black shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            Search Analytics
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* TABS CONTENT */}
      {activeTab === 'live' ? (
        loading ? (
          <div className="text-sm text-white/40">Loading…</div>
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<ParkingSquare className="h-6 w-6" />}
            title="No listings yet"
            description="Live status will show up here once dealers add listings."
          />
        ) : (
          <>
            <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                  All listings
                </CardTitle>
                <CardDescription>{pagination?.total ?? listings.length} total</CardDescription>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#0c0c0e]">
                    <tr className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/60">
                      <th className="px-5 py-3">Listing</th>
                      <th className="px-5 py-3">Dealer</th>
                      <th className="px-5 py-3">App bookings</th>
                      <th className="px-5 py-3">Walk-ins</th>
                      <th className="px-5 py-3">Total here</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l) => (
                      <tr
                        key={l.listingId}
                        className="border-b border-white/[0.05] cursor-pointer hover:bg-white/[0.03]"
                        onClick={() => navigate(`/parking-live/${l.listingId}`)}
                      >
                        <td className="px-5 py-4 text-sm font-medium">{l.listingName}</td>
                        <td className="px-5 py-4 text-sm text-white/70">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-white/30" />
                            {l.dealerName} · {l.city}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-white/70">{l.appCount}</td>
                        <td className="px-5 py-4 text-sm text-white/70">{l.walkInCount}</td>
                        <td className="px-5 py-4 text-sm font-bold text-[var(--accent)]">
                          {l.appCount + l.walkInCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-medium text-white/40">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="flex items-center gap-1 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="flex items-center gap-1 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )
      ) : (
        /* SEARCH ANALYTICS TAB */
        <div className="space-y-6">
          {/* Period selector */}
          <div className="flex justify-end">
            <div className="flex items-center rounded-xl border border-white/10 bg-[#18181b] p-1">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setAnalyticsPeriod(days)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    analyticsPeriod === days
                      ? 'bg-[var(--accent)] text-black shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          {analyticsLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-white/40">
              Loading search analytics data…
            </div>
          ) : !analytics ? (
            <div className="flex h-64 items-center justify-center text-sm text-white/40">
              No search analytics recorded yet
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                        Total Searches
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Search className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 text-3xl font-extrabold text-white">
                      {analytics.totalSearches.toLocaleString()}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {analytics.searchGrowthPercent >= 0 ? '+' : ''}
                      {analytics.searchGrowthPercent}% vs prev period
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                        Conversion Rate
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 text-3xl font-extrabold text-indigo-400">
                      {analytics.conversionRate}%
                    </div>
                    <p className="mt-1 text-xs text-white/50">
                      {analytics.totalBookings} total bookings created
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                        Unmet Demand
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 text-3xl font-extrabold text-amber-400">
                      {analytics.unmetDemandPercent}%
                    </div>
                    <p className="mt-1 text-xs text-white/50">
                      {analytics.unmetDemandCount} searches with 0 available spots
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                        Coverage Rate
                      </span>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                        <Layers className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 text-3xl font-extrabold text-white">
                      {analytics.totalSearches > 0
                        ? Math.round((analytics.searchesWithResults / analytics.totalSearches) * 100)
                        : 0}
                      %
                    </div>
                    <p className="mt-1 text-xs text-white/50">Searches returning matched lots</p>
                  </CardContent>
                </Card>
              </div>

              {/* Visual Charts */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Search Volume & Demand Trend */}
                <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-white flex items-center justify-between">
                      <span>Global Search Volume & Unmet Demand</span>
                      <span className="text-xs font-normal text-white/40">Daily Trend</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-white/50">
                      Daily customer search queries vs unmet parking demand
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorSearch" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorUnmet" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                          <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#09090b',
                              borderColor: 'rgba(255,255,255,0.1)',
                              borderRadius: '12px',
                              fontSize: '12px',
                              color: '#fff',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="searches"
                            name="Total Searches"
                            stroke="#10b981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorSearch)"
                          />
                          <Area
                            type="monotone"
                            dataKey="unmetDemand"
                            name="Unmet Demand"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorUnmet)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Search Locations Card */}
                <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[var(--accent)]" />
                      Top Search Clusters
                    </CardTitle>
                    <CardDescription className="text-xs text-white/50">
                      Geographic areas with highest search density
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analytics.topLocations.length === 0 ? (
                      <div className="py-8 text-center text-xs text-white/40">No search locations recorded yet</div>
                    ) : (
                      analytics.topLocations.map((loc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 font-bold text-emerald-400">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-white/80">{loc.location}</span>
                          </div>
                          <span className="font-extrabold text-[var(--accent)]">{loc.count} searches</span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Peak Search Hours Breakdown */}
              <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-base font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[var(--accent)]" />
                      Global Peak Search Hours
                    </span>
                    <span className="text-xs font-normal text-white/40">24-Hour Distribution</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">
                    System-wide hourly breakdown of parking search traffic
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.peakSearchHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="hour" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10 }} />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#09090b',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: '#fff',
                          }}
                        />
                        <Bar dataKey="searches" name="Searches" fill="var(--accent, #10b981)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
