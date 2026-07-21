import { useEffect, useState } from 'react';
import { dealerApi } from '../../api/dealerClient';
import type { DealerBooking, WalkInHistoryEntry } from '../../api/dealerClient';
import { Card, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { History, Car, Bike, Search } from 'lucide-react';
import { format } from 'date-fns';

interface UnifiedHistoryItem {
  id: string;
  vehicleNumber: string;
  vehicleType: 'CAR' | 'BIKE';
  source: 'Online Booking' | 'Walk-in';
  listingName: string;
  amountPaid: number;
  paymentMethod?: string;
  parkedAt: Date;
  leftAt: Date;
}

export default function DealerHistory() {
  const [historyItems, setHistoryItems] = useState<UnifiedHistoryItem[]>([]);
  const [listings, setListings] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter states
  const [selectedListingId, setSelectedListingId] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [bookingsRes, listingsRes] = await Promise.all([
          dealerApi.listBookings(),
          dealerApi.listListings(),
        ]);

        if (!bookingsRes.success) {
          setError(bookingsRes.error.message);
          setLoading(false);
          return;
        }
        if (!listingsRes.success) {
          setError(listingsRes.error.message);
          setLoading(false);
          return;
        }

        setListings(listingsRes.data.map(l => ({ id: l.id, name: l.name })));

        // Fetch walk-in history for each listing
        const walkInHistoryPromises = listingsRes.data.map((listing) =>
          dealerApi.getWalkInHistory(listing.id)
        );
        const walkInHistories = await Promise.all(walkInHistoryPromises);

        const items: UnifiedHistoryItem[] = [];

        // 1. Process completed/checked out online bookings
        bookingsRes.data.forEach((b: DealerBooking) => {
          if (b.actualCheckOutTime) {
            const extra = b.extraAmountPaise ?? 0;
            items.push({
              id: b.id,
              vehicleNumber: b.vehicleNumber ?? 'Online Reservation',
              vehicleType: 'CAR', // Default to CAR for reservation type if not specified
              source: 'Online Booking',
              listingName: b.listing.name,
              amountPaid: (b.amountPaise + extra) / 100,
              paymentMethod: 'ONLINE',
              parkedAt: new Date(b.startTime),
              leftAt: new Date(b.actualCheckOutTime),
            });
          }
        });

        // 2. Process walk-in histories
        walkInHistories.forEach((res, index) => {
          if (res.success) {
            const listingName = listingsRes.data[index].name;
            res.data.forEach((w: WalkInHistoryEntry) => {
              items.push({
                id: w.id,
                vehicleNumber: w.vehicleNumber,
                vehicleType: w.vehicleType,
                source: 'Walk-in',
                listingName: listingName,
                amountPaid: w.amountPaise / 100,
                paymentMethod: w.paymentMethod ?? 'CASH',
                parkedAt: new Date(w.enteredAt),
                leftAt: new Date(w.exitedAt),
              });
            });
          }
        });

        // Sort by check-out time descending (most recent first)
        items.sort((a, b) => b.leftAt.getTime() - a.leftAt.getTime());
        setHistoryItems(items);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch history data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredItems = historyItems.filter((item) => {
    const matchesListing = selectedListingId === 'all' || item.listingName === listings.find(l => l.id === selectedListingId)?.name;
    const matchesSource = selectedSource === 'all' || 
      (selectedSource === 'online' && item.source === 'Online Booking') ||
      (selectedSource === 'walkin' && item.source === 'Walk-in');
    const matchesSearch = item.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.listingName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesListing && matchesSource && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Global History</h1>
        <p className="text-sm text-white/60">Chronological checkout history across all your parking lots</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

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
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="h-10 rounded-xl bg-white/[0.02] border border-white/[0.08] px-4 text-sm font-medium text-white focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300 appearance-none min-w-[160px]"
          >
            <option value="all" className="bg-zinc-900 text-white">All Sources</option>
            <option value="online" className="bg-zinc-900 text-white">Online Bookings</option>
            <option value="walkin" className="bg-zinc-900 text-white">Walk-ins</option>
          </select>
        </div>
        <div className="w-full md:w-80 relative">
          <input
            type="text"
            placeholder="Search vehicle or lot..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl bg-white/[0.02] border border-white/[0.08] pl-11 pr-4 text-sm font-medium text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300"
          />
          <Search className="h-4 w-4 text-white/30 absolute left-4 top-3 transition-colors" />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-white/40">Loading history…</div>
      ) : filteredItems.length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" />} title="No history found" description="No history entries match your filters." />
      ) : (
        <Card className="bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/30">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-white/[0.04] text-xs font-bold uppercase tracking-widest text-white/30 bg-white/[0.01]">
                  <th className="px-5 py-4 rounded-tl-xl">Vehicle</th>
                  <th className="px-5 py-4">Source</th>
                  <th className="px-5 py-4">Listing / Lot</th>
                  <th className="px-5 py-4">Amount Paid</th>
                  <th className="px-5 py-4">Parked Duration</th>
                  <th className="px-5 py-4 rounded-tr-xl">Departed At</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-4 text-sm font-bold flex items-center gap-2">
                      {item.vehicleType === 'CAR' ? <Car className="h-4 w-4 text-[var(--accent)]" /> : <Bike className="h-4 w-4 text-[var(--accent)]" />}
                      {item.vehicleNumber}
                    </td>
                    <td className="px-5 py-4">
                      {item.source === 'Online Booking' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-purple-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                          Online Booking
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                          Walk-in
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-white">{item.listingName}</td>
                    <td className="px-5 py-4 text-sm font-bold text-emerald-400">
                      ₹{item.amountPaid.toFixed(0)}
                      {item.paymentMethod && <span className="ml-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest">({item.paymentMethod})</span>}
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-white/50">
                      {format(item.parkedAt, 'MMM d, h:mm a')} <span className="text-white/30 mx-1">—</span> {format(item.leftAt, 'h:mm a')}
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-white/50">{format(item.leftAt, 'MMM d, h:mm a')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
