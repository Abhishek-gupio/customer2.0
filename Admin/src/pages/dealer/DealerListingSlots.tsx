import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, CalendarX } from 'lucide-react';
import { format } from 'date-fns';
import { dealerApi, type DealerSlotWindow } from '../../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function DealerListingSlots() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [windows, setWindows] = useState<DealerSlotWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fromDate: todayIso(),
    toDate: todayIso(),
    startHour: '6',
    endHour: '22',
    capacity: '10',
  });

  const load = () => {
    if (!id) return;
    setLoading(true);
    dealerApi.listSlotWindows(id).then((res) => {
      setLoading(false);
      if (res.success) setWindows(res.data);
      else setError(res.error.message);
    });
  };

  useEffect(load, [id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError('');
    setSubmitting(true);
    const res = await dealerApi.createSlotWindows(id, {
      fromDate: new Date(form.fromDate).toISOString(),
      toDate: new Date(form.toDate).toISOString(),
      startHour: parseInt(form.startHour, 10),
      endHour: parseInt(form.endHour, 10),
      capacity: parseInt(form.capacity, 10),
    });
    setSubmitting(false);
    if (res.success) load();
    else setError(res.error.message);
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/dealer/listings')} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to listings
      </button>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Availability</h1>
        <p className="text-sm text-white/60">Set the hours and capacity customers can book</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add availability</CardTitle>
          <CardDescription>Applies the same hours and capacity to every day in the range</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
            <Field label="From">
              <input type="date" className={inputClass} value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} />
            </Field>
            <Field label="To">
              <input type="date" className={inputClass} value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
            </Field>
            <Field label="Start hour (0-23)">
              <input type="number" min={0} max={23} className={inputClass} value={form.startHour} onChange={(e) => setForm({ ...form, startHour: e.target.value })} />
            </Field>
            <Field label="End hour (1-24)">
              <input type="number" min={1} max={24} className={inputClass} value={form.endHour} onChange={(e) => setForm({ ...form, endHour: e.target.value })} />
            </Field>
            <Field label="Capacity">
              <input type="number" min={1} className={inputClass} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </Field>
            {error && <p className="col-span-full text-sm text-red-400">{error}</p>}
            <div className="col-span-full">
              <Button type="submit" disabled={submitting}>
                <CalendarPlus className="h-4 w-4 mr-1" />
                {submitting ? 'Saving…' : 'Save availability'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : windows.length === 0 ? (
        <EmptyState icon={<CalendarX className="h-6 w-6" />} title="No availability set yet" description="Add a date range above so customers can book this lot." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/60">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Hours</th>
                  <th className="px-5 py-3">Capacity</th>
                  <th className="px-5 py-3">Booked</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((w) => (
                  <tr key={w.id} className="border-b border-white/[0.05]">
                    <td className="px-5 py-3 text-sm">{format(new Date(w.date), 'EEE, MMM d')}</td>
                    <td className="px-5 py-3 text-sm text-white/70">{w.startHour}:00 – {w.endHour}:00</td>
                    <td className="px-5 py-3 text-sm text-white/70">{w.capacity}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={w.booked >= w.capacity ? 'text-red-400 font-semibold' : 'text-emerald-400'}>
                        {w.booked} / {w.capacity}
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
