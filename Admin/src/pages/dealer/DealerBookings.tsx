import { useEffect, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { format } from 'date-fns';
import { dealerApi, type DealerBooking } from '../../api/dealerClient';
import { Card, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';

const STATUS_STYLE: Record<DealerBooking['status'], string> = {
  PENDING_PAYMENT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-white/5 text-white/40 border-white/10',
  COMPLETED: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  NO_SHOW: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function DealerBookings() {
  const [bookings, setBookings] = useState<DealerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dealerApi.listBookings().then((res) => {
      setLoading(false);
      if (res.success) setBookings(res.data);
      else setError(res.error.message);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Bookings</h1>
        <p className="text-sm text-white/60">Across all your listings</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : bookings.length === 0 ? (
        <EmptyState icon={<CalendarRange className="h-6 w-6" />} title="No bookings yet" description="Bookings for your listings will show up here." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/60">
                  <th className="px-5 py-3">Listing</th>
                  <th className="px-5 py-3">Window</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-white/[0.05]">
                    <td className="px-5 py-3 text-sm font-medium">{b.listing.name}</td>
                    <td className="px-5 py-3 text-sm text-white/70">
                      {format(new Date(b.startTime), 'MMM d, h:mm a')} – {format(new Date(b.endTime), 'h:mm a')}
                    </td>
                    <td className="px-5 py-3 text-sm text-white/70">₹{(b.amountPaise / 100).toFixed(0)}</td>
                    <td className="px-5 py-3">
                      <span className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest', STATUS_STYLE[b.status])}>
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
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
