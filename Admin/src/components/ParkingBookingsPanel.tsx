import { useEffect, useState } from 'react';
import { dealerApi, type DealerBooking, type Pagination } from '../api/dealerClient';
import { ParkingBookingsTable } from './ParkingBookingsTable';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

/**
 * Dealer and employee "Online Bookings" are the same page against two
 * differently-scoped APIs (dealer sees every lot, employee sees only
 * assigned ones) — one component parametrized by which API client to call,
 * instead of two near-identical page files.
 */
type BookingsApi = Pick<
  typeof dealerApi,
  'listBookings' | 'listListings' | 'checkoutBooking' | 'markBookingCheckedIn' | 'undoBookingNoShow'
>;

export function ParkingBookingsPanel({ api }: { api: BookingsApi }) {
  const [bookings, setBookings] = useState<DealerBooking[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [listings, setListings] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [markingCheckedInId, setMarkingCheckedInId] = useState<string | null>(null);
  const [undoingNoShowId, setUndoingNoShowId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [page, setPage] = useState(1);

  // Filter states
  const [selectedListingId, setSelectedListingId] = useState<string>('all');
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Debounce the search box so every keystroke doesn't fire a request —
  // date/tab/page changes below apply immediately since they're discrete actions.
  useEffect(() => {
    const timeout = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.listBookings({
        scope: activeTab,
        page,
        limit: PAGE_SIZE,
        q: searchQuery || undefined,
        from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
      }),
      api.listListings(),
    ]).then(([bookingsRes, listingsRes]) => {
      setLoading(false);
      if (bookingsRes.success) {
        setBookings(bookingsRes.data.data);
        setPagination(bookingsRes.data.pagination);
      } else setError(bookingsRes.error.message);

      if (listingsRes.success) setListings(listingsRes.data.map((l) => ({ id: l.id, name: l.name })));
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [activeTab, page, searchQuery, dateFrom, dateTo]);

  // Switching tabs, or changing a filter, starts back at page 1 — a stale
  // page number from a different filter/tab combination wouldn't mean anything here.
  const switchTab = (tab: 'active' | 'history') => {
    setActiveTab(tab);
    setPage(1);
  };
  const updateSearch = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };
  const updateDateFrom = (value: string) => {
    setDateFrom(value);
    setPage(1);
  };
  const updateDateTo = (value: string) => {
    setDateTo(value);
    setPage(1);
  };

  const handleCheckout = async (bookingId: string) => {
    setError('');
    setCheckingOutId(bookingId);
    const res = await api.checkoutBooking(bookingId);
    setCheckingOutId(null);
    if (res.success) {
      load();
    } else {
      setError(res.error.message);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    setError('');
    setMarkingCheckedInId(bookingId);
    const res = await api.markBookingCheckedIn(bookingId);
    setMarkingCheckedInId(null);
    if (res.success) {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, ...res.data } : b)));
    } else {
      setError(res.error.message);
    }
  };

  const handleUndoNoShow = async (bookingId: string) => {
    setError('');
    setUndoingNoShowId(bookingId);
    const res = await api.undoBookingNoShow(bookingId);
    setUndoingNoShowId(null);
    if (res.success) {
      load();
    } else {
      setError(res.error.message);
    }
  };

  const filteredBookings = bookings.filter(
    (b) => selectedListingId === 'all' || b.listingId === selectedListingId,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Online Bookings</h1>
        <p className="text-sm text-white/60">Manage online app reservations and check out vehicles when they leave</p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#18181b]/80 border border-white/[0.04] p-4 rounded-2xl backdrop-blur-xl shadow-lg shadow-black/20">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {listings.length > 1 && (
            <select
              value={selectedListingId}
              onChange={(e) => setSelectedListingId(e.target.value)}
              className="h-10 rounded-xl bg-white/[0.02] border border-white/[0.08] px-4 text-sm font-medium text-white focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300 appearance-none min-w-[160px]"
            >
              <option value="all" className="bg-zinc-900 text-white">All Lots</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id} className="bg-zinc-900 text-white">{l.name}</option>
              ))}
            </select>
          )}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => updateDateFrom(e.target.value)}
            className="h-10 rounded-xl bg-white/[0.02] border border-white/[0.08] px-3 text-sm font-medium text-white focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300"
          />
          <span className="text-white/30 text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => updateDateTo(e.target.value)}
            className="h-10 rounded-xl bg-white/[0.02] border border-white/[0.08] px-3 text-sm font-medium text-white focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300"
          />
        </div>
        <div className="w-full md:w-80 relative">
          <input
            type="text"
            placeholder="Search vehicle, customer, lot…"
            value={searchInput}
            onChange={(e) => updateSearch(e.target.value)}
            className="h-10 w-full rounded-xl bg-white/[0.02] border border-white/[0.08] pl-11 pr-4 text-sm font-medium text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300"
          />
          <Search className="h-4 w-4 text-white/30 absolute left-4 top-3 transition-colors" />
        </div>
      </div>

      {/* Tab Selector */}
      <div>
        <div className="inline-flex p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl gap-1 shadow-inner">
          <button
            onClick={() => switchTab('active')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${
              activeTab === 'active'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            Active Reservations
          </button>
          <button
            onClick={() => switchTab('history')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${
              activeTab === 'history'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : (
        <>
          <ParkingBookingsTable
            bookings={filteredBookings}
            onCheckout={handleCheckout}
            checkingOutId={checkingOutId}
            onCheckIn={handleCheckIn}
            markingCheckedInId={markingCheckedInId}
            onUndoNoShow={handleUndoNoShow}
            undoingNoShowId={undoingNoShowId}
            error={error}
          />
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
      )}
    </div>
  );
}
