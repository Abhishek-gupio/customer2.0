import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, IndianRupee, Car, Bike, CalendarClock, ParkingSquare, Camera, Loader2, Radio } from 'lucide-react';
import { dealerApi, type DealerListing } from '../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { cn } from '../lib/cn';

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

type ListingsApi = Pick<typeof dealerApi, 'listListings'> &
  Partial<Pick<typeof dealerApi, 'createListing' | 'uploadPhotos'>>;

/**
 * Dealer and employee both browse a grid of parking lots and jump to
 * Availability/Live status from a card — dealer can additionally create a
 * lot, price it, and upload photos, which the employee can't. One component,
 * `canManage` gates the owner-only actions instead of a second file
 * reimplementing the read-only 80%.
 */
export function ParkingListingsPanel({
  api,
  basePath,
  canManage,
  heading,
  subheading,
  emptyDescription,
}: {
  api: ListingsApi;
  basePath: string;
  canManage: boolean;
  heading: string;
  subheading: string;
  emptyDescription: string;
}) {
  const navigate = useNavigate();
  const [listings, setListings] = useState<DealerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.listListings().then((res) => {
      setLoading(false);
      if (res.success) setListings(res.data);
      else setError(res.error.message);
    });
  };

  useEffect(load, []);

  const handlePhotoUpload = async (listingId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !api.uploadPhotos) return;
    setUploadingId(listingId);
    const res = await api.uploadPhotos(listingId, Array.from(fileList));
    setUploadingId(null);
    if (res.success) {
      setListings((prev) => prev.map((l) => (l.id === listingId ? res.data : l)));
    } else {
      setError(res.error.message);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api.createListing) return;
    setError('');
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const hourlyRatePaise = Math.round(parseFloat(form.hourlyRatePaise || '0') * 100);
    if (!form.name || !form.addressLine || !form.city || Number.isNaN(lat) || Number.isNaN(lng) || !hourlyRatePaise) {
      setError('Fill in all fields with valid values.');
      return;
    }
    setSubmitting(true);
    const res = await api.createListing({
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
          <h1 className="text-2xl font-extrabold tracking-tight">{heading}</h1>
          <p className="text-sm text-white/60">{subheading}</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-4 w-4 mr-1" />
            {showForm ? 'Cancel' : 'Add Listing'}
          </Button>
        )}
      </div>

      {canManage && showForm && (
        <Card className="bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/30">
          <CardHeader className="border-b border-white/[0.04] bg-white/[0.01]">
            <CardTitle className="text-lg font-bold">New listing</CardTitle>
            <CardDescription className="text-white/40">Coordinates can be copied from Google Maps (right-click a point → coordinates)</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Name">
                <input className={inputClass} placeholder="e.g. Central Mall Parking" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="City">
                <input className={inputClass} placeholder="e.g. Mumbai" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label="Address" className="md:col-span-2">
                <input className={inputClass} placeholder="Full street address" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} />
              </Field>
              <Field label="Latitude">
                <input className={inputClass} placeholder="e.g. 19.0760" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </Field>
              <Field label="Longitude">
                <input className={inputClass} placeholder="e.g. 72.8777" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </Field>
              <Field label="Car capacity">
                <input type="number" min={0} className={inputClass} value={form.fourWheelerCapacity} onChange={(e) => setForm({ ...form, fourWheelerCapacity: e.target.value })} />
              </Field>
              <Field label="Bike capacity">
                <input type="number" min={0} className={inputClass} value={form.twoWheelerCapacity} onChange={(e) => setForm({ ...form, twoWheelerCapacity: e.target.value })} />
              </Field>
              <Field label="Hourly rate (₹)">
                <div className="relative group">
                  <IndianRupee className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 group-focus-within:text-emerald-400 transition-colors" />
                  <input type="number" min={0} step="1" className={cn(inputClass, "pl-11")} value={form.hourlyRatePaise} onChange={(e) => setForm({ ...form, hourlyRatePaise: e.target.value })} />
                </div>
              </Field>
              {error && <p className="md:col-span-2 text-sm font-semibold text-red-400">{error}</p>}
              <div className="md:col-span-2 pt-2">
                <Button type="submit" disabled={submitting} className="h-12 w-full md:w-auto font-bold px-8">
                  {submitting ? 'Creating…' : 'Create listing'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && !showForm && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : listings.length === 0 ? (
        <EmptyState icon={<ParkingSquare className="h-6 w-6" />} title="No listings yet" description={emptyDescription} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <Card
              key={listing.id}
              className="cursor-pointer bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:border-emerald-500/30 transition-all duration-300 overflow-hidden group"
              onClick={() => navigate(`${basePath}/${listing.id}/slots`)}
            >
              <CardHeader className="bg-white/[0.01] border-b border-white/[0.04] relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <CardTitle className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">{listing.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 mt-1 text-white/50">
                      <MapPin className="h-3.5 w-3.5" />
                      {listing.addressLine}, {listing.city}
                    </CardDescription>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border', STATUS_STYLE[listing.status])}>
                    {listing.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className={cn('pt-5', canManage ? 'pb-4' : 'pb-5 flex items-center justify-between')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-2.5 py-1 border border-white/[0.04]">
                      <Car className="h-4 w-4 text-white/60" />
                      <span className="text-sm font-bold text-white">{listing.fourWheelerCapacity}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/[0.03] rounded-lg px-2.5 py-1 border border-white/[0.04]">
                      <Bike className="h-4 w-4 text-white/60" />
                      <span className="text-sm font-bold text-white">{listing.twoWheelerCapacity}</span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-0.5">Rate</span>
                      <span className="flex items-center font-black text-lg text-emerald-400">
                        ₹{(listing.hourlyRatePaise / 100).toFixed(0)}
                        <span className="text-sm font-medium text-emerald-400/60 ml-0.5">/hr</span>
                      </span>
                    </div>
                  )}
                </div>
                {!canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`${basePath}/${listing.id}/live`);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-2.5 py-1.5 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  >
                    <Radio className="h-3.5 w-3.5 animate-pulse" />
                    Live
                  </button>
                )}
              </CardContent>

              {canManage && listing.photos.length > 0 && (
                <div className="flex gap-2 px-5 pb-5 overflow-x-auto">
                  {listing.photos.map((url) => (
                    <img key={url} src={url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover border border-white/10 shadow-sm" />
                  ))}
                </div>
              )}

              {canManage && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.04] bg-white/[0.01]">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white/40 group-hover:text-white/60 transition-colors">
                      <CalendarClock className="h-4 w-4" />
                      Manage
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${basePath}/${listing.id}/live`);
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                      <Radio className="h-3.5 w-3.5 animate-pulse" />
                      Live
                    </button>
                  </div>
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-white cursor-pointer transition-colors"
                  >
                    {uploadingId === listing.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
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
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const inputClass =
  'h-12 w-full rounded-xl bg-white/[0.02] border border-white/[0.08] px-4 text-sm font-medium text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:bg-white/[0.04] focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all duration-300';

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/50">{label}</label>
      {children}
    </div>
  );
}
