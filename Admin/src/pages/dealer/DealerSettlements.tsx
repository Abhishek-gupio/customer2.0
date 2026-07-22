import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { dealerApi, type ParkingSettlement, type Pagination } from '../../api/dealerClient';
import { Card, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

const PAGE_SIZE = 20;

const STATUS_STYLE: Record<ParkingSettlement['status'], { bg: string; text: string; dot: string }> = {
  PENDING: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  COMPLETED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
};

export default function DealerSettlements() {
  const [settlements, setSettlements] = useState<ParkingSettlement[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    dealerApi.listSettlements({ page, limit: PAGE_SIZE }).then((res) => {
      setLoading(false);
      if (res.success) {
        setSettlements(res.data.data);
        setPagination(res.data.pagination);
      } else {
        setError(res.error.message);
      }
    });
  }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Settlements</h1>
        <p className="text-sm text-white/60">Daily payouts generated from your completed bookings and walk-ins</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : settlements.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="No settlements yet" description="Settlements are generated daily once you have completed bookings or walk-ins." />
      ) : (
        <Card className="bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/30">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.04] text-xs font-bold uppercase tracking-widest text-white/30 bg-white/[0.01]">
                  <th className="px-5 py-4 rounded-tl-xl">Date</th>
                  <th className="px-5 py-4">Total Collected</th>
                  <th className="px-5 py-4">Gupio Commission</th>
                  <th className="px-5 py-4">Payout</th>
                  <th className="px-5 py-4 rounded-tr-xl">Status</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => {
                  const style = STATUS_STYLE[s.status];
                  return (
                    <tr key={s.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-4 text-sm font-bold text-white">{format(new Date(s.date), 'MMM d, yyyy')}</td>
                      <td className="px-5 py-4 text-sm font-medium text-white/70">₹{(s.totalCollected / 100).toFixed(0)}</td>
                      <td className="px-5 py-4 text-sm font-medium text-white/40">₹{(s.gupioCommission / 100).toFixed(0)}</td>
                      <td className="px-5 py-4 text-sm font-bold text-emerald-400">₹{(s.amountSettled / 100).toFixed(0)}</td>
                      <td className="px-5 py-4">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest', style.bg, style.text)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)}></span>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
