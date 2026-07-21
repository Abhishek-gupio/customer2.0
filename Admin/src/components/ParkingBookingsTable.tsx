import { LogOut, CalendarRange } from 'lucide-react';
import { format } from 'date-fns';
import type { DealerBooking } from '../api/dealerClient';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { cn } from '../lib/cn';

const STATUS_STYLE: Record<DealerBooking['status'], { bg: string, text: string, dot: string }> = {
  PENDING_PAYMENT: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  CONFIRMED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  CANCELLED: { bg: 'bg-white/5', text: 'text-white/40', dot: 'bg-white/40' },
  COMPLETED: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', dot: 'bg-indigo-500' },
  NO_SHOW: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
};

export function ParkingBookingsTable({
  bookings,
  onCheckout,
  checkingOutId,
  error,
}: {
  bookings: DealerBooking[];
  onCheckout: (bookingId: string) => void;
  checkingOutId: string | null;
  error: string;
}) {
  if (bookings.length === 0) {
    return <EmptyState icon={<CalendarRange className="h-6 w-6" />} title="No bookings yet" description="Bookings for your listings will show up here." />;
  }

  return (
    <Card className="bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/30">
      <CardContent className="p-0 overflow-x-auto">
        {error && <p className="px-5 pt-4 text-sm font-semibold text-red-400">{error}</p>}
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-white/[0.04] text-xs font-bold uppercase tracking-widest text-white/30 bg-white/[0.01]">
              <th className="px-5 py-4 rounded-tl-xl">Listing</th>
              <th className="px-5 py-4">Window</th>
              <th className="px-5 py-4">Amount</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 rounded-tr-xl">Checkout</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const style = STATUS_STYLE[b.status];
              return (
                <tr key={b.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-4 text-sm font-bold text-white flex items-center gap-2">
                    {b.listing.name}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-white/70">
                    {format(new Date(b.startTime), 'MMM d, h:mm a')} <span className="text-white/30 mx-1">—</span> {format(new Date(b.endTime), 'h:mm a')}
                  </td>
                  <td className="px-5 py-4 text-sm font-bold text-white">
                    ₹{(b.amountPaise / 100).toFixed(0)}
                    {b.extraAmountPaise != null && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-400">
                        +₹{(b.extraAmountPaise / 100).toFixed(0)} overstay
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest', style.bg, style.text)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)}></span>
                      {b.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {b.status === 'CONFIRMED' && !b.actualCheckOutTime ? (
                      <Button
                        onClick={() => onCheckout(b.id)}
                        disabled={checkingOutId === b.id}
                        className="h-8! px-4! text-xs! font-bold bg-white/5 hover:bg-white/10 text-white shadow-none transition-all"
                      >
                        <LogOut className="h-3.5 w-3.5 mr-1.5" />
                        {checkingOutId === b.id ? 'Checking out…' : 'Check out'}
                      </Button>
                    ) : b.actualCheckOutTime && b.extraAmountPaise != null && b.status === 'CONFIRMED' ? (
                      <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Awaiting overstay payment</span>
                    ) : b.actualCheckOutTime ? (
                      <span className="text-xs font-semibold text-white/40">{format(new Date(b.actualCheckOutTime), 'MMM d, h:mm a')}</span>
                    ) : (
                      <span className="text-xs font-bold text-white/20">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
