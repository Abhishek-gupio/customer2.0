import { useEffect, useState } from 'react';
import { Receipt, AlertTriangle } from 'lucide-react';
import { adminApi, type PaymentOrderListItem } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate } from '../lib/dateUtils';
import { cn } from '../lib/cn';

const STATUS_STYLE: Record<PaymentOrderListItem['status'], string> = {
  CREATED: 'bg-white/5 text-white/50 border-white/10',
  ATTEMPTED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
  CANCELLED: 'bg-white/5 text-white/40 border-white/10',
};

export default function PaymentsOps() {
  const [orders, setOrders] = useState<PaymentOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stuckOnly, setStuckOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; totalPages: number } | null>(null);

  useEffect(() => {
    setLoading(true);
    adminApi.listPaymentOrders({ stuckOnly, page, limit: 25 }).then((res) => {
      setLoading(false);
      if (res.success) {
        setOrders(res.data.data);
        setPagination(res.data.pagination);
      } else {
        setError(res.error.message);
      }
    });
  }, [stuckOnly, page]);

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Payments</h1>
          <p className="text-sm text-white/60">Order status across every payment purpose (parking, and future checkouts)</p>
        </div>
        <Button
          variant={stuckOnly ? 'default' : 'secondary'}
          onClick={() => {
            setStuckOnly((s) => !s);
            setPage(1);
          }}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          {stuckOnly ? 'Showing stuck only' : 'Show stuck only'}
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[var(--accent)]" />
            Orders
          </CardTitle>
          <CardDescription>
            {pagination ? `${pagination.total} total` : '—'} · "Stuck" = created/attempted 15+ min ago with no webhook resolution
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            {loading ? (
              <div className="p-6 text-sm text-white/40">Loading…</div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title={stuckOnly ? 'Nothing stuck right now' : 'No orders yet'}
                description={stuckOnly ? 'Every recent order resolved cleanly.' : 'Payment orders will show up here once customers start checking out.'}
              />
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[#0c0c0e]">
                  <tr className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/60">
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Purpose</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Latest attempt</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const latestAttempt = order.attempts[0];
                    return (
                      <tr key={order.id} className={cn('border-b border-white/[0.05]', order.isStuck && 'bg-red-500/[0.04]')}>
                        <td className="px-5 py-4 text-sm">
                          <div className="font-medium">{order.customer.fullName || 'Unnamed'}</div>
                          <div className="text-xs text-white/40">{order.customer.phoneNumber}</div>
                        </td>
                        <td className="px-5 py-4 text-sm text-white/70">{order.purpose.replace('_', ' ')}</td>
                        <td className="px-5 py-4 text-sm text-white/70">₹{(order.amountPaise / 100).toFixed(0)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest', STATUS_STYLE[order.status])}>
                              {order.status}
                            </span>
                            {order.isStuck && (
                              <span title="No webhook resolution in 15+ minutes">
                                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-white/50">
                          {latestAttempt ? `${latestAttempt.status}${latestAttempt.failureReason ? ` — ${latestAttempt.failureReason}` : ''}` : '—'}
                        </td>
                        <td className="px-5 py-4 text-xs text-white/50">{formatDate(order.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/[0.04] bg-black/20 p-4">
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </Button>
              <span className="text-xs text-white/40">Page {page} of {pagination.totalPages}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
