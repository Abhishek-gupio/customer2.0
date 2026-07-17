import { useEffect, useState } from 'react';
import { Plus, MapPin, Droplets, CalendarClock, Users } from 'lucide-react';
import { partnerApi, type WashCenter, type WashTechnician } from '../../api/carwashPartnerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

const emptyCenterForm = { name: '', address: '', latitude: '', longitude: '' };
const emptyTechForm = { name: '', phoneNumber: '', password: '' };
const emptySlotForm = { fromDate: '', toDate: '', intervalHours: '2', capacity: '1' };

export default function PartnerCenters() {
  const [centers, setCenters] = useState<WashCenter[]>([]);
  const [technicians, setTechnicians] = useState<WashTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCenterForm, setShowCenterForm] = useState(false);
  const [showTechForm, setShowTechForm] = useState(false);
  const [centerForm, setCenterForm] = useState(emptyCenterForm);
  const [techForm, setTechForm] = useState(emptyTechForm);
  const [slotForm, setSlotForm] = useState(emptySlotForm);
  const [slotCenterId, setSlotCenterId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [slotResult, setSlotResult] = useState<string>('');
  const [createdTechCreds, setCreatedTechCreds] = useState<{ phoneNumber: string; password: string } | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([partnerApi.listCenters(), partnerApi.listTechnicians()]).then(([centersRes, techRes]) => {
      setLoading(false);
      if (centersRes.success) setCenters(centersRes.data);
      else setError(centersRes.error.message);
      if (techRes.success) setTechnicians(techRes.data);
    });
  };

  useEffect(load, []);

  const handleCreateCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const lat = parseFloat(centerForm.latitude);
    const lng = parseFloat(centerForm.longitude);
    if (!centerForm.name || !centerForm.address || Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Fill in all fields with valid values.');
      return;
    }
    setSubmitting(true);
    const res = await partnerApi.createCenter({ name: centerForm.name, address: centerForm.address, latitude: lat, longitude: lng });
    setSubmitting(false);
    if (res.success) {
      setCenterForm(emptyCenterForm);
      setShowCenterForm(false);
      load();
    } else {
      setError(res.error.message);
    }
  };

  const handleCreateTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!techForm.name || !techForm.phoneNumber || techForm.password.length < 8) {
      setError('Name, phone number, and an 8+ character password are required.');
      return;
    }
    setSubmitting(true);
    const res = await partnerApi.createTechnician(techForm);
    setSubmitting(false);
    if (res.success) {
      setCreatedTechCreds({ phoneNumber: techForm.phoneNumber, password: techForm.password });
      setTechForm(emptyTechForm);
      setShowTechForm(false);
      load();
    } else {
      setError(res.error.message);
    }
  };

  const handleCreateSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotCenterId) return;
    setError('');
    setSlotResult('');
    setSubmitting(true);
    const res = await partnerApi.createSlots(slotCenterId, {
      fromDate: slotForm.fromDate,
      toDate: slotForm.toDate,
      intervalHours: parseInt(slotForm.intervalHours, 10),
      capacity: parseInt(slotForm.capacity, 10),
    });
    setSubmitting(false);
    if (res.success) {
      setSlotResult(`Created ${res.data.count} slots.`);
      setSlotForm(emptySlotForm);
    } else {
      setError(res.error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Wash Centers</h1>
          <p className="text-sm text-white/60">Manage your locations, slots and technicians</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowTechForm((s) => !s)}>
            <Users className="h-4 w-4 mr-1" />
            {showTechForm ? 'Cancel' : 'Add Technician'}
          </Button>
          <Button onClick={() => setShowCenterForm((s) => !s)}>
            <Plus className="h-4 w-4 mr-1" />
            {showCenterForm ? 'Cancel' : 'Add Center'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {createdTechCreds && (
        <Card className="border-emerald-500/30 bg-emerald-500/[0.04]">
          <CardContent className="py-4">
            <p className="text-sm text-emerald-300">
              Technician added. Share these sign-in details with them directly — this password is not shown again:
            </p>
            <p className="mt-2 font-mono text-sm text-white">
              Phone: {createdTechCreds.phoneNumber} · Password: {createdTechCreds.password}
            </p>
          </CardContent>
        </Card>
      )}

      {showTechForm && (
        <Card>
          <CardHeader>
            <CardTitle>New technician</CardTitle>
            <CardDescription>They'll sign in on their own device with the phone number and password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTechnician} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name">
                <input className={inputClass} value={techForm.name} onChange={(e) => setTechForm({ ...techForm, name: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <input className={inputClass} value={techForm.phoneNumber} onChange={(e) => setTechForm({ ...techForm, phoneNumber: e.target.value })} />
              </Field>
              <Field label="Temporary password (min 8 chars)">
                <input type="text" className={inputClass} value={techForm.password} onChange={(e) => setTechForm({ ...techForm, password: e.target.value })} />
              </Field>
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'Adding…' : 'Add technician'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {showCenterForm && (
        <Card>
          <CardHeader>
            <CardTitle>New wash center</CardTitle>
            <CardDescription>Coordinates can be copied from Google Maps (right-click a point → coordinates)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCenter} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name">
                <input className={inputClass} value={centerForm.name} onChange={(e) => setCenterForm({ ...centerForm, name: e.target.value })} />
              </Field>
              <Field label="Address">
                <input className={inputClass} value={centerForm.address} onChange={(e) => setCenterForm({ ...centerForm, address: e.target.value })} />
              </Field>
              <Field label="Latitude">
                <input className={inputClass} value={centerForm.latitude} onChange={(e) => setCenterForm({ ...centerForm, latitude: e.target.value })} />
              </Field>
              <Field label="Longitude">
                <input className={inputClass} value={centerForm.longitude} onChange={(e) => setCenterForm({ ...centerForm, longitude: e.target.value })} />
              </Field>
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create center'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {technicians.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-[var(--accent)]" />
              Technicians ({technicians.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {technicians.map((t) => (
              <span key={t.id} className="rounded-lg bg-white/5 px-3 py-1.5 text-sm text-white/80">
                {t.name} · {t.phoneNumber}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : centers.length === 0 ? (
        <EmptyState icon={<Droplets className="h-6 w-6" />} title="No wash centers yet" description="Add your first location to start taking visit-center bookings." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {centers.map((center) => (
            <Card key={center.id}>
              <CardHeader>
                <CardTitle className="text-base">{center.name}</CardTitle>
                <CardDescription className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {center.address}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {slotCenterId === center.id ? (
                  <form onSubmit={handleCreateSlots} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="From">
                        <input type="date" className={inputClass} value={slotForm.fromDate} onChange={(e) => setSlotForm({ ...slotForm, fromDate: e.target.value })} />
                      </Field>
                      <Field label="To">
                        <input type="date" className={inputClass} value={slotForm.toDate} onChange={(e) => setSlotForm({ ...slotForm, toDate: e.target.value })} />
                      </Field>
                      <Field label="Interval (hrs)">
                        <input type="number" min={1} max={12} className={inputClass} value={slotForm.intervalHours} onChange={(e) => setSlotForm({ ...slotForm, intervalHours: e.target.value })} />
                      </Field>
                      <Field label="Capacity">
                        <input type="number" min={1} className={inputClass} value={slotForm.capacity} onChange={(e) => setSlotForm({ ...slotForm, capacity: e.target.value })} />
                      </Field>
                    </div>
                    {slotResult && <p className="text-xs text-emerald-400">{slotResult}</p>}
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={submitting}>{submitting ? 'Creating…' : 'Generate slots'}</Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setSlotCenterId(null)}>Close</Button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => { setSlotCenterId(center.id); setSlotResult(''); }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white transition-colors"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Generate slots
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
