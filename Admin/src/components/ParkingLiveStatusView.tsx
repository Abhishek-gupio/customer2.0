import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { Car, Bike, LogOut, Radio, Banknote, CreditCard, History, X } from 'lucide-react';
import { format } from 'date-fns';
import type {
  ListingLiveStatus,
  DealerSlotWindow,
  ParkingVehicleType,
  ParkingPaymentMethod,
  WalkIn,
  WalkInHistoryEntry,
  Pagination,
} from '../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { useParkingLiveSocket } from '../hooks/useParkingLiveSocket';

type ApiResult<T> = { success: true; data: T } | { success: false; error: { message: string } };

const HISTORY_PAGE_SIZE = 20;

export interface ParkingLiveStatusViewProps {
  listingId: string;
  fetchStatus: (listingId: string) => Promise<ApiResult<ListingLiveStatus>>;
  fetchSlotWindows?: (listingId: string) => Promise<ApiResult<DealerSlotWindow[]>>;
  fetchHistory?: (
    listingId: string,
    params?: { page?: number; limit?: number },
  ) => Promise<ApiResult<{ data: WalkInHistoryEntry[]; pagination: Pagination }>>;
  onCheckIn?: (
    listingId: string,
    slotWindowId: string,
    data: { vehicleType: ParkingVehicleType; vehicleNumber: string },
  ) => Promise<ApiResult<WalkIn>>;
  onCheckOut?: (walkInId: string, paymentMethod: ParkingPaymentMethod) => Promise<ApiResult<WalkIn>>;
  /** Undefined disables realtime (e.g. no socket token available yet). */
  socketToken?: string | null;
  socketActorType?: 'dealer' | 'parkingEmployee' | 'admin';
  /**
   * Explicit ops-visibility mode — hides check-in/checkout controls even if
   * the callback props happen to be passed, and shows a caption explaining
   * why. Without this, "read-only" was only ever an implicit side effect of
   * a caller simply not passing onCheckIn/onCheckOut.
   */
  readOnly?: boolean;
}

const PAYMENT_METHOD_LABEL: Record<ParkingPaymentMethod, string> = { CASH: 'Cash', ONLINE: 'Online' };

const todayIso = () => new Date().toISOString().slice(0, 10);

function findCurrentSlotWindow(windows: DealerSlotWindow[]): DealerSlotWindow | undefined {
  const now = new Date();
  const today = todayIso();
  const hour = now.getHours();
  return windows.find((w) => w.date.slice(0, 10) === today && w.startHour <= hour && hour < w.endHour);
}

export function ParkingLiveStatusView({
  listingId,
  fetchStatus,
  fetchSlotWindows,
  fetchHistory,
  onCheckIn,
  onCheckOut,
  socketToken,
  socketActorType,
  readOnly = false,
}: ParkingLiveStatusViewProps) {
  const [status, setStatus] = useState<ListingLiveStatus | null>(null);
  const [currentSlot, setCurrentSlot] = useState<DealerSlotWindow | null>(null);
  const [history, setHistory] = useState<WalkInHistoryEntry[]>([]);
  const [historyPagination, setHistoryPagination] = useState<Pagination | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ vehicleType: 'CAR' as ParkingVehicleType, vehicleNumber: '' });
  const [submitting, setSubmitting] = useState(false);
  const [exitingId, setExitingId] = useState<string | null>(null);
  /** Which row's "how did they pay" picker is open — null once resolved or dismissed. */
  const [confirmingExitId, setConfirmingExitId] = useState<string | null>(null);
  const [liveTab, setLiveTab] = useState<'parked' | 'history'>('parked');
  const [qrModalData, setQrModalData] = useState<{ shortUrl: string; amount: number; walkInId: string } | null>(null);

  const canCheckIn = !readOnly && !!(onCheckIn && fetchSlotWindows);
  const canCheckOut = !readOnly && !!onCheckOut;

  const load = async () => {
    const [statusRes, slotsRes, historyRes] = await Promise.all([
      fetchStatus(listingId),
      fetchSlotWindows ? fetchSlotWindows(listingId) : Promise.resolve(null),
      fetchHistory ? fetchHistory(listingId, { page: historyPage, limit: HISTORY_PAGE_SIZE }) : Promise.resolve(null),
    ]);
    setLoading(false);
    if (statusRes.success) setStatus(statusRes.data);
    else setError(statusRes.error.message);
    if (slotsRes?.success) setCurrentSlot(findCurrentSlotWindow(slotsRes.data) ?? null);
    if (historyRes?.success) {
      setHistory(historyRes.data.data);
      setHistoryPagination(historyRes.data.pagination);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, historyPage]);

  useParkingLiveSocket(socketToken ?? null, socketActorType ?? 'dealer', load);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCheckIn || !currentSlot) return;
    setError('');
    if (!form.vehicleNumber.trim()) {
      setError('Enter the vehicle number.');
      return;
    }
    setSubmitting(true);
    const res = await onCheckIn(listingId, currentSlot.id, {
      vehicleType: form.vehicleType,
      vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
    });
    setSubmitting(false);
    if (res.success) {
      setForm({ vehicleType: 'CAR', vehicleNumber: '' });
      load();
    } else {
      setError(res.error.message);
    }
  };

  const handleCheckOut = async (walkIn: WalkIn, paymentMethod: ParkingPaymentMethod) => {
    if (!onCheckOut) return;
    setError('');
    setExitingId(walkIn.id);
    const res = await onCheckOut(walkIn.id, paymentMethod);
    setExitingId(null);
    setConfirmingExitId(null);
    if (res.success) {
      if (res.data?.paymentLink) {
        setQrModalData({ 
          shortUrl: res.data.paymentLink.shortUrl, 
          amount: res.data.amountPaise, 
          walkInId: walkIn.id 
        });
      }
      load();
    }
    else setError(res.error.message);
  };

  if (loading) return <div className="text-sm text-white/40">Loading…</div>;

  const totalWalkInsParked = status?.walkIns.length ?? 0;
  const totalBookingsParked = status?.bookings.length ?? 0;
  const currentOccupancy = totalWalkInsParked + totalBookingsParked;

  const todayHistory = history.filter((h) => {
    const todayStr = new Date().toDateString();
    return new Date(h.exitedAt).toDateString() === todayStr;
  });

  const walkInRevenueToday = todayHistory.reduce((sum, h) => sum + h.amountPaise, 0) / 100;
  const cashRevenue = todayHistory.filter((h) => h.paymentMethod === 'CASH').reduce((sum, h) => sum + h.amountPaise, 0) / 100;
  const onlineRevenue = todayHistory.filter((h) => h.paymentMethod === 'ONLINE').reduce((sum, h) => sum + h.amountPaise, 0) / 100;
  const departuresToday = todayHistory.length;

  return (
    <div className="space-y-6">
      {qrModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 relative shadow-2xl animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setQrModalData(null)}
              className="absolute top-4 right-4 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white mb-2">Scan to Pay Online</h3>
              <p className="text-emerald-400 font-mono text-2xl">₹{(qrModalData.amount / 100).toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl flex items-center justify-center mb-6">
              <QRCode value={qrModalData.shortUrl} size={200} />
            </div>
            <p className="text-sm text-center text-white/50">
              Ask the customer to scan this QR code with any UPI app to complete the payment.
            </p>
            <Button 
              className="w-full mt-6 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
              onClick={() => setQrModalData(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {readOnly && (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs font-semibold text-white/50">
          <Radio className="h-3.5 w-3.5 text-white/30" />
          Ops visibility — read-only. Check-in and checkout happen on-site from the dealer or staff app.
        </div>
      )}

      {/* Live Data Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="relative overflow-hidden bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/50 transition-all duration-300 hover:shadow-black/80 hover:border-white/[0.08]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-white/40">Active Occupancy</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/10">
                <Car className="h-4 w-4 text-[var(--accent)]" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tighter text-white">{currentOccupancy}</span>
              <span className="text-sm font-medium text-white/40">vehicles</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-white/30 flex items-center gap-1.5">
              <span className="text-white/50">{totalWalkInsParked}</span> Walk-ins • <span className="text-white/50">{totalBookingsParked}</span> Bookings
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/50 transition-all duration-300 hover:shadow-black/80 hover:border-white/[0.08]">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.03] to-transparent pointer-events-none" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-500/50">Today's Revenue</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                <Banknote className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tighter text-emerald-400">₹{walkInRevenueToday.toFixed(0)}</span>
              <span className="text-sm font-medium text-white/40">collected</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-white/30 flex items-center gap-1.5">
              <span className="text-white/50">₹{cashRevenue.toFixed(0)}</span> Cash • <span className="text-white/50">₹{onlineRevenue.toFixed(0)}</span> Online
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/50 transition-all duration-300 hover:shadow-black/80 hover:border-white/[0.08]">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.03] to-transparent pointer-events-none" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-500/50">Departures</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10">
                <LogOut className="h-4 w-4 text-amber-400" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tighter text-amber-400">{departuresToday}</span>
              <span className="text-sm font-medium text-white/40">completed</span>
            </div>
            <div className="mt-2 text-xs font-semibold text-white/30">
              Walk-in checkouts today
            </div>
          </CardContent>
        </Card>
      </div>

    {canCheckIn && (
        <Card className="bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/30">
          <CardHeader className="border-b border-white/[0.04] bg-white/[0.01]">
            <CardTitle className="text-lg font-bold">Check in a walk-in</CardTitle>
            <CardDescription className="text-white/40">
              {currentSlot
                ? `Using today's ${currentSlot.startHour}:00–${currentSlot.endHour}:00 availability window`
                : 'No availability window covers the current hour — ask the lot owner to add one.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCheckIn} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/50">Vehicle</label>
                <div className="flex gap-2 p-1 bg-white/[0.03] rounded-xl border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, vehicleType: 'CAR' })}
                    className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all duration-300 ${
                      form.vehicleType === 'CAR' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
                    }`}
                  >
                    <Car className="h-4 w-4" /> Car
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, vehicleType: 'BIKE' })}
                    className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all duration-300 ${
                      form.vehicleType === 'BIKE' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white hover:bg-white/[0.02]'
                    }`}
                  >
                    <Bike className="h-4 w-4" /> Bike
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/50">Vehicle Number</label>
                <input
                  className={inputClass}
                  placeholder="e.g. KA01AB1234"
                  value={form.vehicleNumber}
                  onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                />
              </div>
              <Button 
                type="submit" 
                disabled={submitting || !currentSlot} 
                className="h-[46px] w-full font-bold bg-emerald-500 hover:bg-emerald-600 text-black shadow-lg shadow-emerald-500/20 transition-all duration-300"
              >
                {submitting ? 'Checking in…' : 'Check in now'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Live Gate Entry Tabs */}
      <div>
        <div className="inline-flex p-1 bg-white/[0.03] border border-white/[0.08] rounded-xl gap-1">
          <button
            onClick={() => setLiveTab('parked')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
              liveTab === 'parked'
                ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/10 font-bold'
                : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            Currently Parked ({currentOccupancy})
          </button>
          {fetchHistory && (
            <button
              onClick={() => setLiveTab('history')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                liveTab === 'history'
                  ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/10 font-bold'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              Checkout History ({historyPagination?.total ?? history.length})
            </button>
          )}
        </div>
      </div>

      {liveTab === 'parked' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[var(--accent)] animate-pulse" />
              Currently parked ({currentOccupancy})
            </CardTitle>
            <CardDescription>Live — updates automatically</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {currentOccupancy === 0 ? (
              <div className="p-6 text-sm text-white/40">Nothing parked here right now.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.04] text-xs font-bold uppercase tracking-widest text-white/30 bg-white/[0.01]">
                    <th className="px-5 py-4 rounded-tl-xl">Vehicle</th>
                    <th className="px-5 py-4">Source</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Since</th>
                    <th className="px-5 py-4">Checked in by</th>
                    {canCheckOut && <th className="px-5 py-4 rounded-tr-xl" />}
                  </tr>
                </thead>
                <tbody>
                  {status?.walkIns.map((w) => (
                    <tr key={w.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-4 text-sm font-bold flex items-center gap-2">
                        {w.vehicleType === 'CAR' ? <Car className="h-4 w-4 text-[var(--accent)]" /> : <Bike className="h-4 w-4 text-[var(--accent)]" />}
                        {w.vehicleNumber}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                          Walk-in
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-white">₹{(w.amountPaise / 100).toFixed(0)}</td>
                      <td className="px-5 py-4 text-xs font-medium text-white/50">{format(new Date(w.enteredAt), 'h:mm a')}</td>
                      <td className="px-5 py-4 text-xs font-medium text-white/50">{w.employeeName ?? 'Dealer'}</td>
                      {canCheckOut && (
                        <td className="px-5 py-4 text-right">
                          {confirmingExitId === w.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">Collect ₹{(w.amountPaise / 100).toFixed(0)}</span>
                              <Button
                                onClick={() => handleCheckOut(w, 'CASH')}
                                disabled={exitingId === w.id}
                                className="h-8! px-3! text-xs! font-bold bg-white/10 hover:bg-white/20 text-white shadow-none"
                              >
                                <Banknote className="h-3.5 w-3.5 mr-1.5" />
                                Cash
                              </Button>
                              <Button
                                onClick={() => handleCheckOut(w, 'ONLINE')}
                                disabled={exitingId === w.id}
                                className="h-8! px-3! text-xs! font-bold bg-white/10 hover:bg-white/20 text-white shadow-none"
                              >
                                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                                Online
                              </Button>
                              <button
                                onClick={() => setConfirmingExitId(null)}
                                disabled={exitingId === w.id}
                                className="text-xs font-bold text-white/30 hover:text-white/70 px-2 uppercase tracking-wider transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <Button onClick={() => setConfirmingExitId(w.id)} className="h-8! px-4! text-xs! font-bold bg-white/5 hover:bg-white/10 text-white shadow-none">
                              <LogOut className="h-3.5 w-3.5 mr-1.5" />
                              Check out
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {status?.bookings.map((b) => (
                    <tr key={b.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-4 text-sm font-bold flex items-center gap-2">
                        <Car className="h-4 w-4 text-[var(--accent)]" />
                        {b.vehicleNumber ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-purple-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                          App Booking
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-white">₹{(b.amountPaise / 100).toFixed(0)}</td>
                      <td className="px-5 py-4 text-xs font-medium text-white/50">{format(new Date(b.startTime), 'h:mm a')}</td>
                      <td className="px-5 py-4 text-xs font-medium text-white/50">{b.customerName ?? b.customerPhone}</td>
                      {canCheckOut && <td className="px-5 py-4 text-xs font-semibold text-white/20 text-right">Manage via Bookings</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      ) : (
        fetchHistory && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-white/50" />
                Recent history
              </CardTitle>
              <CardDescription>{historyPagination?.total ?? history.length} checked-out walk-ins</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {history.length === 0 ? (
                <div className="p-6 text-sm text-white/40">No walk-ins checked out yet.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/60">
                      <th className="px-5 py-3">Vehicle</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Paid via</th>
                      <th className="px-5 py-3">Parked</th>
                      <th className="px-5 py-3">Checked in by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b border-white/[0.05]">
                        <td className="px-5 py-3 text-sm font-medium flex items-center gap-1.5">
                          {h.vehicleType === 'CAR' ? <Car className="h-3.5 w-3.5 text-white/40" /> : <Bike className="h-3.5 w-3.5 text-white/40" />}
                          {h.vehicleNumber}
                        </td>
                        <td className="px-5 py-3 text-sm text-white/70">₹{(h.amountPaise / 100).toFixed(0)}</td>
                        <td className="px-5 py-3 text-xs text-white/50">{h.paymentMethod ? PAYMENT_METHOD_LABEL[h.paymentMethod] : '—'}</td>
                        <td className="px-5 py-3 text-xs text-white/50">
                          {format(new Date(h.enteredAt), 'MMM d, h:mm a')} – {format(new Date(h.exitedAt), 'h:mm a')}
                        </td>
                        <td className="px-5 py-3 text-xs text-white/50">{h.employeeName ?? 'Dealer'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
            {historyPagination && historyPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.05]">
                <span className="text-xs font-medium text-white/40">
                  Page {historyPagination.page} of {historyPagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage <= 1}
                    className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setHistoryPage((p) => Math.min(historyPagination.totalPages, p + 1))}
                    disabled={historyPage >= historyPagination.totalPages}
                    className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>
        )
      )}
    </div>
  );
}

const inputClass =
  'h-[46px] w-full rounded-xl bg-white/[0.02] border border-white/[0.08] px-4 text-sm font-medium text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300';
