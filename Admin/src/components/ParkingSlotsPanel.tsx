import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, CalendarX, Radio } from 'lucide-react';
import { format } from 'date-fns';
import { dealerApi, type DealerSlotWindow } from '../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { cn } from '../lib/cn';

const todayIso = () => new Date().toISOString().slice(0, 10);

type SlotsApi = Pick<typeof dealerApi, 'listSlotWindows' | 'listListings'> &
  Partial<Pick<typeof dealerApi, 'createSlotWindows'>>;

/**
 * Availability table — dealer can set the hours/capacity customers book
 * against; employee reads it (capacity is the lot owner's call, not
 * theirs to set) and sees a couple fewer columns since raw capacity/booked
 * counts aren't theirs to act on either. Same table, `canManage` gates the
 * create form and the owner-only columns.
 */
export function ParkingSlotsPanel({ api, basePath, canManage }: { api: SlotsApi; basePath: string; canManage: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listingName, setListingName] = useState('');
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

  useEffect(() => {
    if (canManage) return; // dealer already knows which lot — only employee's heading needs the name
    api.listListings().then((res) => {
      if (res.success) {
        const current = res.data.find((l) => l.id === id);
        if (current) setListingName(current.name);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = () => {
    if (!id) return;
    setLoading(true);
    api.listSlotWindows(id).then((res) => {
      setLoading(false);
      if (res.success) setWindows(res.data);
      else setError(res.error.message);
    });
  };

  useEffect(load, [id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !api.createSlotWindows) return;
    setError('');
    setSubmitting(true);
    const res = await api.createSlotWindows(id, {
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
      <button onClick={() => navigate(basePath)} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to listings
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Availability{!canManage && listingName ? ` — ${listingName}` : ''}
          </h1>
          <p className="text-sm text-white/60">
            {canManage ? 'Set the hours and capacity customers can book' : 'Check walk-in parkings in and out from the Live status page'}
          </p>
        </div>
        {id && (
          <Button onClick={() => navigate(`${basePath}/${id}/live`)}>
            <Radio className="h-4 w-4 mr-1" />
            Live status
          </Button>
        )}
      </div>

      {canManage && (
        <Card className="bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/30">
          <CardHeader className="border-b border-white/[0.04] bg-white/[0.01]">
            <CardTitle className="text-lg font-bold">Add availability</CardTitle>
            <CardDescription className="text-white/40">Applies the same hours and capacity to every day in the range</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-5 gap-6 items-end">
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
              {error && <p className="col-span-full text-sm font-semibold text-red-400">{error}</p>}
              <div className="col-span-full pt-2">
                <Button type="submit" disabled={submitting} className="h-12 px-8 font-bold text-sm w-full md:w-auto">
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  {submitting ? 'Saving…' : 'Save availability'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : windows.length === 0 ? (
        <EmptyState
          icon={<CalendarX className="h-6 w-6" />}
          title="No availability set yet"
          description={canManage ? 'Add a date range above so customers can book this lot.' : 'Ask your parking lot owner to set up availability for this lot.'}
        />
      ) : (
        <Card className="bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/30 overflow-hidden">
          {!canManage && (
            <CardHeader className="border-b border-white/[0.04] bg-white/[0.01]">
              <CardTitle className="text-lg font-bold">Today & upcoming</CardTitle>
              <CardDescription className="text-white/40">Read-only — capacity is set by the lot owner</CardDescription>
            </CardHeader>
          )}
          <CardContent className="p-0 overflow-x-auto">
            {error && <p className="px-6 pt-5 text-sm font-semibold text-red-400">{error}</p>}
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-white/[0.04] text-xs font-bold uppercase tracking-widest text-white/30 bg-white/[0.01]">
                  <th className="px-6 py-4 rounded-tl-xl">Date</th>
                  <th className="px-6 py-4">Hours</th>
                  {canManage && <th className="px-6 py-4">Capacity</th>}
                  {canManage && <th className="px-6 py-4">Booked (app)</th>}
                  <th className="px-6 py-4">Walk-ins</th>
                  <th className="px-6 py-4 rounded-tr-xl">Available</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((w) => {
                  const occupied = w.booked + w.manualOccupiedCars + w.manualOccupiedBikes;
                  const available = Math.max(w.capacity - occupied, 0);
                  return (
                    <tr key={w.id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                      <td className="px-6 py-4 text-sm font-bold text-white">{format(new Date(w.date), 'EEE, MMM d')}</td>
                      <td className="px-6 py-4 text-sm font-medium text-white/70">{w.startHour}:00 – {w.endHour}:00</td>
                      {canManage && <td className="px-6 py-4 text-sm font-medium text-white/70">{w.capacity}</td>}
                      {canManage && <td className="px-6 py-4 text-sm font-medium text-white/70">{w.booked}</td>}
                      <td className="px-6 py-4 text-sm font-medium text-white/70">{w.manualOccupiedCars + w.manualOccupiedBikes}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase',
                          available === 0
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        )}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', available === 0 ? 'bg-red-500' : 'bg-emerald-500')}></span>
                          {available}
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
