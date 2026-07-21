import { useEffect, useState } from 'react';
import { employeeApi } from '../../api/employeeClient';
import type { DealerBooking } from '../../api/dealerClient';
import { ParkingBookingsTable } from '../../components/ParkingBookingsTable';
import { Search } from 'lucide-react';

export default function EmployeeBookings() {
  const [bookings, setBookings] = useState<DealerBooking[]>([]);
  const [listings, setListings] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Filter states
  const [selectedListingId, setSelectedListingId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const load = () => {
    Promise.all([
      employeeApi.listBookings(),
      employeeApi.listListings(),
    ]).then(([bookingsRes, listingsRes]) => {
      setLoading(false);
      if (bookingsRes.success) setBookings(bookingsRes.data);
      else setError(bookingsRes.error.message);

      if (listingsRes.success) setListings(listingsRes.data.map(l => ({ id: l.id, name: l.name })));
    });
  };

  useEffect(load, []);

  const handleCheckout = async (bookingId: string) => {
    setError('');
    setCheckingOutId(bookingId);
    const res = await employeeApi.checkoutBooking(bookingId);
    setCheckingOutId(null);
    if (res.success) {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, ...res.data } : b)));
    } else {
      setError(res.error.message);
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesListing = selectedListingId === 'all' || b.listingId === selectedListingId;
    const matchesSearch = 
      (b.vehicleNumber && b.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.customerName && b.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.customerPhone && b.customerPhone.toLowerCase().includes(searchQuery.toLowerCase())) ||
      b.listing.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesListing && matchesSearch;
  });

  const activeBookings = filteredBookings.filter((b) => b.status === 'CONFIRMED' && !b.actualCheckOutTime);
  const historyBookings = filteredBookings.filter((b) => b.status !== 'CONFIRMED' || !!b.actualCheckOutTime);

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
        </div>
        <div className="w-full md:w-80 relative">
          <input
            type="text"
            placeholder="Search vehicle number or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl bg-white/[0.02] border border-white/[0.08] pl-11 pr-4 text-sm font-medium text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300"
          />
          <Search className="h-4 w-4 text-white/30 absolute left-4 top-3 transition-colors" />
        </div>
      </div>

      {/* Tab Selector */}
      <div>
        <div className="inline-flex p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl gap-1 shadow-inner">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${
              activeTab === 'active'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            Active Reservations ({activeBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${
              activeTab === 'history'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            History ({historyBookings.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : activeTab === 'active' ? (
        <ParkingBookingsTable bookings={activeBookings} onCheckout={handleCheckout} checkingOutId={checkingOutId} error={error} />
      ) : (
        <ParkingBookingsTable bookings={historyBookings} onCheckout={handleCheckout} checkingOutId={checkingOutId} error={error} />
      )}
    </div>
  );
}
