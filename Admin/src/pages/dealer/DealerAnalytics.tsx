import { useEffect, useState } from 'react';
import {
  Eye,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Sparkles,
  BarChart3,
  CheckCircle2,
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
import { dealerApi, type DealerSearchAnalytics, type DealerListing } from '../../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';

export default function DealerAnalytics() {
  const [period, setPeriod] = useState<number>(7);
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [listings, setListings] = useState<DealerListing[]>([]);
  const [analytics, setAnalytics] = useState<DealerSearchAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dealerApi.listListings().then((res) => {
      if (res.success) {
        setListings(res.data);
      }
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    dealerApi
      .getSearchAnalytics({ period, listingId: selectedListingId || undefined })
      .then((res) => {
        setLoading(false);
        if (res.success) {
          setAnalytics(res.data);
        } else {
          setError(res.error.message);
        }
      });
  }, [period, selectedListingId]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[var(--accent)]" />
            Search & Area Analytics
          </h1>
          <p className="text-sm text-white/60">
            Real-time insights on how customers find and search for your parking lots
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Listing Filter */}
          <select
            value={selectedListingId}
            onChange={(e) => setSelectedListingId(e.target.value)}
            className="rounded-xl border border-white/10 bg-[#18181b] px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">All Parking Lots</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.city})
              </option>
            ))}
          </select>

          {/* Period selector buttons */}
          <div className="flex items-center rounded-xl border border-white/10 bg-[#18181b] p-1">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  period === days
                    ? 'bg-[var(--accent)] text-black shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-white/40">
          Loading search analytics…
        </div>
      ) : !analytics ? (
        <div className="flex h-64 items-center justify-center text-sm text-white/40">
          No analytics data available
        </div>
      ) : (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Impressions Card */}
            <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                    Search Impressions
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Eye className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-extrabold text-white">
                  {analytics.totalImpressions.toLocaleString()}
                </div>
                <p className="mt-1 text-xs text-white/50">
                  Times your lot appeared in search results
                </p>
              </CardContent>
            </Card>

            {/* Nearby Demand Card */}
            <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                    Area Search Demand
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    <MapPin className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-extrabold text-white">
                  {analytics.nearbySearchDemand.toLocaleString()}
                </div>
                <p className="mt-1 text-xs text-white/50">
                  Searches within 10km radius of your lot
                </p>
              </CardContent>
            </Card>

            {/* Conversion Rate Card */}
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
                <div className="mt-3 text-3xl font-extrabold text-emerald-400">
                  {analytics.conversionRate}%
                </div>
                <p className="mt-1 text-xs text-white/50">
                  {analytics.dealerBookings} online bookings from search
                </p>
              </CardContent>
            </Card>

            {/* Lost Demand / Sold Out Card */}
            <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                    Sold-out Demand
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-extrabold text-amber-400">
                  {analytics.lostDemandCount.toLocaleString()}
                </div>
                <p className="mt-1 text-xs text-white/50">
                  Searches when your lot was marked sold out
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Visual Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Impressions & Nearby Area Demand Trend Chart */}
            <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-bold text-white flex items-center justify-between">
                  <span>Search Visibility & Area Demand Trend</span>
                  <span className="text-xs font-normal text-white/40">Last {period} Days</span>
                </CardTitle>
                <CardDescription className="text-xs text-white/50">
                  Comparing your lot search impressions against total area search demand
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorImp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
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
                        dataKey="impressions"
                        name="Search Impressions"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorImp)"
                      />
                      <Area
                        type="monotone"
                        dataKey="nearbyDemand"
                        name="Nearby Area Demand"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorDemand)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Search Demand Highlights */}
            <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl flex flex-col justify-between">
              <div>
                <CardHeader>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                    Demand Insights
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">
                    Optimization tips based on customer search activity
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-white/80">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Search Impression Share
                    </div>
                    <p className="text-white/60">
                      Your parking lot captures{' '}
                      <strong className="text-white">
                        {analytics.nearbySearchDemand > 0
                          ? Math.round((analytics.totalImpressions / analytics.nearbySearchDemand) * 100)
                          : 0}%
                      </strong>{' '}
                      of all searches performed in your vicinity.
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="flex items-center gap-2 font-bold text-amber-400 mb-1">
                      <AlertTriangle className="h-4 w-4" />
                      Capacity Optimization
                    </div>
                    <p className="text-white/60">
                      You had <strong className="text-white">{analytics.lostDemandCount}</strong> searches when
                      your lot was sold out. Consider opening more hourly slot windows to capture missed revenue.
                    </p>
                  </div>
                </CardContent>
              </div>

              <div className="p-6 pt-0">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center">
                  <span className="text-xs font-semibold text-white/50">Total Online Bookings</span>
                  <div className="text-2xl font-extrabold text-white mt-0.5">{analytics.dealerBookings}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Peak Search Hours Bar Chart */}
          <Card className="border-white/[0.06] bg-[#18181b]/80 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-base font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--accent)]" />
                  Peak Search Hours (Hourly Breakdown)
                </span>
                <span className="text-xs font-normal text-white/40">24 Hours (00:00 - 23:00)</span>
              </CardTitle>
              <CardDescription className="text-xs text-white/50">
                Hourly distribution showing when customers search for parking near your lot
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
                    <Bar dataKey="impressions" name="Lot Impressions" fill="var(--accent, #10b981)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="nearbyDemand" name="Area Demand" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
