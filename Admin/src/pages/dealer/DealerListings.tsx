import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, IndianRupee, Car, Bike, CalendarClock, ParkingSquare, Camera, Loader2 } from 'lucide-react';
import { dealerApi, type DealerListing } from '../../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';

const STATUS_STYLE: Record<DealerListing['status'], string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PAUSED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  REMOVED: 'bg-white/5 text-white/40 border-white/10',
};

const emptyForm = {
  name: '',
  addressLine: '',
  city: '',
  latitude: '',
  longitude: '',
  fourWheelerCapacity: '10',
  twoWheelerCapacity: '0',
  hourlyRatePaise: '',
};

export default function DealerListings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<DealerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const handlePhotoUpload = async (listingId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingId(listingId);
    const res = await dealerApi.uploadPhotos(listingId, Array.from(fileList));
    setUploadingId(null);
    if (res.success) {
      setListings((prev) => prev.map((l) => (l.id === listingId ? res.data : l)));
    } else {
      setError(res.error.message);
    }
  };

  const load = () => {
    setLoading(true);
    dealerApi.listListings().then((res) => {
      setLoading(false);
      if (res.success) setListings(res.data);
      else setError(res.error.message);
    });
  };

  useEffect(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const hourlyRatePaise = Math.round(parseFloat(form.hourlyRatePaise || '0') * 100);
    if (!form.name || !form.addressLine || !form.city || Number.isNaN(lat) || Number.isNaN(lng) || !hourlyRatePaise) {
      setError('Fill in all fields with valid values.');
      return;
    }
    setSubmitting(true);
    const res = await dealerApi.createListing({
      name: form.name,
      addressLine: form.addressLine,
      city: form.city,
      latitude: lat,
      longitude: lng,
      fourWheelerCapacity: parseInt(form.fourWheelerCapacity, 10) || 0,
      twoWheelerCapacity: parseInt(form.twoWheelerCapacity, 10) || 0,
      hourlyRatePaise,
    });
    setSubmitting(false);
    if (res.success) {
      setForm(emptyForm);
      setShowForm(false);
      load();
    } else {
      setError(res.error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your Listings</h1>
          <p className="text-sm text-white/60">Manage lots, pricing and availability</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4 mr-1" />
          {showForm ? 'Cancel' : 'Add Listing'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New listing</CardTitle>
            <CardDescription>Coordinates can be copied from Google Maps (right-click a point → coordinates)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name">
                <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="City">
                <input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label="Address" className="md:col-span-2">
                <input className={inputClass} value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} />
              </Field>
              <Field label="Latitude">
                <input className={inputClass} value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </Field>
              <Field label="Longitude">
                <input className={inputClass} value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </Field>
              <Field label="Car capacity">
                <input type="number" min={0} className={inputClass} value={form.fourWheelerCapacity} onChange={(e) => setForm({ ...form, fourWheelerCapacity: e.target.value })} />
              </Field>
              <Field label="Bike capacity">
                <input type="number" min={0} className={inputClass} value={form.twoWheelerCapacity} onChange={(e) => setForm({ ...form, twoWheelerCapacity: e.target.value })} />
              </Field>
              <Field label="Hourly rate (₹)">
                <input type="number" min={0} step="1" className={inputClass} value={form.hourlyRatePaise} onChange={(e) => setForm({ ...form, hourlyRatePaise: e.target.value })} />
              </Field>
              {error && <p className="md:col-span-2 text-sm text-red-400">{error}</p>}
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create listing'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={<ParkingSquare className="h-6 w-6" />}
          title="No listings yet"
          description="Add your first parking lot to start taking bookings."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <Card key={listing.id} className="cursor-pointer hover:border-white/20 transition-colors" onClick={() => navigate(`/dealer/listings/${listing.id}/slots`)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{listing.name}</CardTitle>
                  <span className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest', STATUS_STYLE[listing.status])}>
                    {listing.status}
                  </span>
                </div>
                <CardDescription className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {listing.addressLine}, {listing.city}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-white/70">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{listing.fourWheelerCapacity}</span>
                  <span className="flex items-center gap-1"><Bike className="h-3.5 w-3.5" />{listing.twoWheelerCapacity}</span>
                </div>
                <span className="flex items-center gap-1 font-bold text-[var(--accent)]">
                  <IndianRupee className="h-3.5 w-3.5" />{(listing.hourlyRatePaise / 100).toFixed(0)}/hr
                </span>
              </CardContent>

              {listing.photos.length > 0 && (
                <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto">
                  {listing.photos.map((url) => (
                    <img key={url} src={url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover border border-white/10" />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between px-5 pb-4">
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Manage availability
                </div>
                <label
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-white cursor-pointer transition-colors"
                >
                  {uploadingId === listing.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                  {uploadingId === listing.id ? 'Uploading…' : 'Add photos'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(listing.id, e.target.files)}
                  />
                </label>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded-xl bg-white/[0.05] border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:outline-none';

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">{label}</label>
      {children}
    </div>
  );
}
