import { useEffect, useState } from 'react';
import { MessageSquare, ShieldAlert, TrendingUp, Clock, CheckCircle2, Ban, Trash2 } from 'lucide-react';
import {
  adminApi,
  type MessagingReport,
  type MessagingConversationListItem,
  type MessagingAnalytics,
} from '../api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/dateUtils';

function StatCard({ label, value, icon: IconCmp }: { label: string; value: string | number; icon: any }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
          <IconCmp className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-black tracking-tight">{value}</div>
          <div className="text-[11px] uppercase font-bold tracking-widest text-white/40">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Messaging() {
  const [analytics, setAnalytics] = useState<MessagingAnalytics | null>(null);
  const [reports, setReports] = useState<MessagingReport[]>([]);
  const [conversations, setConversations] = useState<MessagingConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportFilter, setReportFilter] = useState<'PENDING' | ''>('PENDING');

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.getMessagingAnalytics(),
      adminApi.listMessagingReports(reportFilter || undefined),
      adminApi.listMessagingConversations({ limit: 20 }),
    ]).then(([analyticsRes, reportsRes, conversationsRes]) => {
      setLoading(false);
      if (analyticsRes.success) setAnalytics(analyticsRes.data);
      if (reportsRes.success) setReports(reportsRes.data);
      if (conversationsRes.success) setConversations(conversationsRes.data.data);
      if (!analyticsRes.success) setError(analyticsRes.error.message);
    });
  };

  useEffect(load, [reportFilter]);

  const handleResolveReport = async (id: string, status: 'REVIEWED' | 'DISMISSED' | 'ACTIONED') => {
    const res = await adminApi.resolveMessagingReport(id, status);
    if (res.success) load();
    else setError(res.error.message);
  };

  const handleSuspend = async (customerId: string) => {
    const reason = window.prompt('Reason for suspending this customer from messaging:');
    if (!reason) return;
    const res = await adminApi.suspendMessagingCustomer(customerId, reason);
    if (res.success) load();
    else setError(res.error.message);
  };

  const handleDeleteConversation = async (id: string) => {
    if (!window.confirm('Delete this conversation and all its messages? This cannot be undone.')) return;
    const res = await adminApi.deleteMessagingConversation(id);
    if (res.success) load();
    else setError(res.error.message);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Vehicle QR Messaging</h1>
        <p className="text-sm text-white/60">Reports, moderation, and conversation activity</p>
      </div>

      {error && (
        <div className="rounded-2xl border border-[rgba(220,53,69,0.35)] bg-[rgba(220,53,69,0.10)] p-5 text-white">
          <div className="text-sm font-semibold">Error</div>
          <div className="mt-1 text-sm text-white/70">{error}</div>
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Conversations" value={analytics.totalConversations} icon={MessageSquare} />
          <StatCard label="Messages" value={analytics.totalMessages} icon={MessageSquare} />
          <StatCard label="Resolution rate" value={`${Math.round(analytics.resolutionRate * 100)}%`} icon={CheckCircle2} />
          <StatCard label="Pending reports" value={analytics.pendingReports} icon={ShieldAlert} />
          <StatCard label="Active today" value={analytics.dailyActiveConversations} icon={TrendingUp} />
          <StatCard
            label="Avg owner response"
            value={analytics.avgOwnerResponseTimeMinutes != null ? `${analytics.avgOwnerResponseTimeMinutes}m` : '—'}
            icon={Clock}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[var(--accent)]" />
                Reports
              </CardTitle>
              <CardDescription>Filed by either party in a conversation</CardDescription>
            </div>
            <div className="flex gap-2">
              {(['PENDING', ''] as const).map((f) => (
                <button
                  key={f || 'all'}
                  onClick={() => setReportFilter(f)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest',
                    reportFilter === f ? 'bg-[var(--accent)] text-black' : 'bg-white/5 text-white/50',
                  )}
                >
                  {f || 'All'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-white/40">Loading…</div>
          ) : reports.length === 0 ? (
            <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="No reports" className="rounded-none border-0 bg-transparent py-12" />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/60">
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Filed</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.05]">
                    <td className="px-5 py-3 text-sm font-medium">{r.conversation?.vehicle.registrationNumber ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-white/70 max-w-xs truncate">{r.reason}</td>
                    <td className="px-5 py-3 text-xs uppercase font-bold text-white/50">{r.status}</td>
                    <td className="px-5 py-3 text-xs text-white/40">{formatDate(r.createdAt)}</td>
                    <td className="px-5 py-3">
                      {r.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleResolveReport(r.id, 'DISMISSED')}>Dismiss</Button>
                          <Button size="sm" variant="secondary" onClick={() => handleResolveReport(r.id, 'ACTIONED')}>Actioned</Button>
                          <Button size="sm" variant="secondary" onClick={() => handleSuspend(r.reportedId)}>
                            <Ban className="h-3.5 w-3.5 mr-1" />Suspend reported user
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--accent)]" />
            Recent Conversations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {conversations.length === 0 ? (
            <EmptyState icon={<MessageSquare className="h-6 w-6" />} title="No conversations yet" className="rounded-none border-0 bg-transparent py-12" />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/60">
                  <th className="px-5 py-3">Vehicle</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Messages</th>
                  <th className="px-5 py-3">Reports</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.05]">
                    <td className="px-5 py-3 text-sm font-medium">{c.vehicle.registrationNumber}</td>
                    <td className="px-5 py-3 text-sm text-white/70">{c.owner.fullName ?? c.owner.phoneNumber}</td>
                    <td className="px-5 py-3 text-sm text-white/70">{c.customer.fullName ?? c.customer.phoneNumber}</td>
                    <td className="px-5 py-3 text-xs uppercase font-bold text-white/50">{c.status.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-sm text-white/70">{c._count.messages}</td>
                    <td className="px-5 py-3 text-sm">
                      {c._count.reports > 0 ? <span className="text-red-400 font-bold">{c._count.reports}</span> : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/40">{formatDate(c.updatedAt)}</td>
                    <td className="px-5 py-3">
                      <Button size="sm" variant="secondary" onClick={() => handleDeleteConversation(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
