import { useEffect, useState } from 'react';
import { Plus, ParkingSquare, LayoutList } from 'lucide-react';
import { adminApi, type ParkingDealerListItem } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate } from '../lib/dateUtils';
import { cn } from '../lib/cn';

const STATUS_STYLE: Record<ParkingDealerListItem['status'], string> = {
  VERIFIED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PENDING_VERIFICATION: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  SUSPENDED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const emptyForm = { ownerName: '', phoneNumber: '', email: '', password: '' };

export default function ParkingDealers() {
  const [dealers, setDealers] = useState<ParkingDealerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ phoneNumber: string; password: string } | null>(null);

  const load = () => {
    setLoading(true);
    adminApi.listParkingDealers().then((res) => {
      setLoading(false);
      if (res.success) setDealers(res.data);
      else setError(res.error.message);
    });
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.ownerName || !form.phoneNumber || form.password.length < 8) {
      setError('Owner name, phone number, and an 8+ character password are required.');
      return;
    }
    setSubmitting(true);
    const res = await adminApi.createParkingDealer({
      ownerName: form.ownerName,
      phoneNumber: form.phoneNumber,
      email: form.email || undefined,
      password: form.password,
    });
    setSubmitting(false);
    if (res.success) {
      setCreatedCreds({ phoneNumber: form.phoneNumber, password: form.password });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } else {
      setError(res.error.message);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Parking Dealers</h1>
          <p className="text-sm text-white/60">Onboard parking-lot operators onto the Parking Partner Portal</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4 mr-1" />
          {showForm ? 'Cancel' : 'Add Dealer'}
        </Button>
      </div>

      {createdCreds && (
        <Card className="border-emerald-500/30 bg-emerald-500/[0.04]">
          <CardContent className="py-4">
            <p className="text-sm text-emerald-300">
              Dealer created. Share these sign-in details with them directly — this password is not shown again:
            </p>
            <p className="mt-2 font-mono text-sm text-white">
              Phone: {createdCreds.phoneNumber} · Password: {createdCreds.password}
            </p>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New dealer</CardTitle>
            <CardDescription>They'll sign in at /dealer/login with the phone number and password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Owner name">
                <input className={inputClass} value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <input className={inputClass} value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
              </Field>
              <Field label="Email (optional)">
                <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Temporary password (min 8 chars)">
                <input type="text" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Field>
              {error && <p className="md:col-span-2 text-sm text-red-400">{error}</p>}
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create dealer'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ParkingSquare className="h-4 w-4 text-[var(--accent)]" />
            Onboarded Dealers
          </CardTitle>
          <CardDescription>{dealers.length} total</CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-sm text-white/40">Loading…</div>
          ) : dealers.length === 0 ? (
            <EmptyState
              icon={<ParkingSquare className="h-6 w-6" />}
              title="No dealers yet"
              description="Add a parking-lot operator to get them started on the Partner Portal."
            />
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0c0c0e]">
                <tr className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/60">
                  <th className="px-5 py-3">Dealer</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Listings</th>
                  <th className="px-5 py-3">Onboarded</th>
                </tr>
              </thead>
              <tbody>
                {dealers.map((d) => (
                  <tr key={d.id} className="border-b border-white/[0.05]">
                    <td className="px-5 py-4 text-sm font-medium">{d.ownerName}</td>
                    <td className="px-5 py-4 text-sm text-white/70">{d.phoneNumber}</td>
                    <td className="px-5 py-4">
                      <span className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest', STATUS_STYLE[d.status])}>
                        {d.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/70">
                      <span className="flex items-center gap-1.5">
                        <LayoutList className="h-3.5 w-3.5 text-white/30" />
                        {d._count?.listings ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-white/50">{formatDate(d.createdAt)}</td>
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

const inputClass =
  'h-10 w-full rounded-xl bg-white/[0.05] border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">{label}</label>
      {children}
    </div>
  );
}
