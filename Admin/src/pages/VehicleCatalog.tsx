import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Car, Bike, Layers, Search, ImageOff, Grid3X3, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Edit2, Loader2, Upload, Plus } from 'lucide-react';
import { adminApi, type CatalogVehicle } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';

// ─── Fallback SVG (inline — never fails to load) ─────────────────────────────
function NoImagePlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#111]">
      <ImageOff className="h-7 w-7 text-white/[0.08]" />
      <span className="text-[10px] font-bold text-white/[0.12] uppercase tracking-wider">No Image</span>
    </div>
  );
}

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; Icon: typeof Car; color: string }> = {
  CAR: { label: '4-Wheelers', Icon: Car, color: 'text-blue-400' },
  BIKE: { label: '2-Wheelers', Icon: Bike, color: 'text-orange-400' },
  COMMERCIAL: { label: 'Commercial', Icon: Layers, color: 'text-violet-400' },
};

function typeLabel(t: string) { return TYPE_CONFIG[t]?.label ?? t; }

// ─── Single vehicle card ──────────────────────────────────────────────────────
function VehicleCard({ vehicle, onOpen }: { vehicle: CatalogVehicle; onOpen: (v: CatalogVehicle) => void }) {
  const heroImg = vehicle.images?.find(i => i.type === 'HERO') ?? vehicle.images?.[0];
  const [failed, setFailed] = useState(false);

  return (
    <div
      onClick={() => onOpen(vehicle)}
      className="group flex flex-col rounded-2xl border border-white/[0.07] bg-[#0c0c0c] overflow-hidden transition-all duration-300 hover:border-[var(--accent)]/30 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:-translate-y-0.5 cursor-pointer"
    >

      {/* -- Image -- */}
      <div className="relative w-full aspect-[16/9] bg-[#111] overflow-hidden flex-shrink-0">
        {/* Type badge */}
        <span className="absolute top-2 left-2 z-10 rounded-md bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white/40">
          {vehicle.vehicleType}
        </span>

        {/* Image count */}
        {(vehicle.images?.length ?? 0) > 1 && (
          <span className="absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-sm px-1.5 py-0.5">
            <Grid3X3 className="h-2.5 w-2.5 text-white/40" />
            <span className="text-[9px] font-bold text-white/40">{vehicle.images.length}</span>
          </span>
        )}

        {heroImg && !failed ? (
          <img
            src={heroImg.assetUrl}
            alt={`${vehicle.make} ${vehicle.model}`}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <NoImagePlaceholder />
        )}
      </div>

      {/* -- Info -- */}
      <div className="p-3 flex flex-col gap-0.5">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-white/30 leading-none">{vehicle.make}</div>
        <div className="text-[14px] font-bold text-white leading-snug">{vehicle.model}</div>
        {vehicle.variant && (
          <div className="text-[11px] text-white/35 font-medium truncate">{vehicle.variant}</div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0c0c0c] overflow-hidden">
      <div className="w-full aspect-[16/9] bg-[#111] animate-pulse" />
      <div className="p-3 space-y-1.5">
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="h-4 w-28" />
      </div>
    </div>
  );
}

// ─── Collapsible brand section ────────────────────────────────────────────────
function BrandSection({ make, vehicles, onOpenVehicle }: { make: string; vehicles: CatalogVehicle[]; onOpenVehicle: (v: CatalogVehicle) => void }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      {/* Brand header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 mb-4 group"
      >
        <div className="h-px flex-1 bg-white/[0.06]" />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/50">{make}</span>
          <span className="text-[9px] font-bold text-white/25 bg-white/[0.05] px-1.5 py-0.5 rounded-md">{vehicles.length}</span>
          {open
            ? <ChevronUp className="h-3 w-3 text-white/25" />
            : <ChevronDown className="h-3 w-3 text-white/25" />
          }
        </div>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </button>

      {/* Grid */}
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {vehicles.map(v => <VehicleCard key={v.id} vehicle={v} onOpen={onOpenVehicle} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VehicleCatalog() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [vehicles, setVehicles] = useState<CatalogVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeType, setActiveType] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<CatalogVehicle | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    adminApi.listCatalogVehicles().then(res => {
      setLoading(false);
      if (res.success) setVehicles(res.data);
      else setError(res.error.message);
    });
  }, []);

  const handleTypeClick = useCallback((t: string) => {
    setActiveType(t);
    setSearch('');
  }, []);

  // Available type tabs derived from data
  const availableTypes = useMemo(() => {
    const types = Array.from(new Set(vehicles.map(v => v.vehicleType))).sort();
    return ['ALL', ...types];
  }, [vehicles]);

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return vehicles.filter(v => {
      const typeOk = activeType === 'ALL' || v.vehicleType === activeType;
      const searchOk = !q
        || v.make.toLowerCase().includes(q)
        || v.model.toLowerCase().includes(q)
        || (v.variant ?? '').toLowerCase().includes(q);
      return typeOk && searchOk;
    });
  }, [vehicles, activeType, search]);

  // Group: vehicleType → make → vehicles[]
  type MakeGroup = Record<string, CatalogVehicle[]>;
  type TypeGroup = Record<string, MakeGroup>;
  const grouped = useMemo<TypeGroup>(() => {
    return filtered.reduce<TypeGroup>((acc, v) => {
      (acc[v.vehicleType] ??= {})[v.make] ??= [];
      acc[v.vehicleType][v.make].push(v);
      return acc;
    }, {});
  }, [filtered]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar pb-16 pr-1">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pt-1">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-white/25 mb-1">Gupio · Admin</div>
              <h1 className="text-[26px] font-black tracking-tight text-white leading-none">Car Library</h1>
              <p className="mt-1.5 text-[13px] text-white/40 font-medium">
                All vehicle models cataloged with S3 imagery
              </p>
            </div>
            
            {isAdmin && (
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="md:hidden h-10 w-10 rounded-xl bg-[var(--accent)] text-black p-0 flex items-center justify-center"
              >
                <Plus className="h-5 w-5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-[340px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="search"
                placeholder="Search make, model, variant…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-[var(--accent)]/40 focus:ring-4 focus:ring-[var(--accent)]/[0.05] transition-all"
              />
            </div>
            
            {isAdmin && (
              <Button 
                onClick={() => setIsAddModalOpen(true)}
                className="hidden md:flex items-center gap-2 h-10 rounded-xl bg-white text-[#0a0a0a] hover:bg-white/90 font-bold px-4 transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Vehicle
              </Button>
            )}
          </div>
        </div>

        {/* ── Type tabs ── */}
        {!loading && (
          <div className="flex items-center gap-2 flex-wrap">
            {availableTypes.map(type => {
              const cfg = type !== 'ALL' ? TYPE_CONFIG[type] : null;
              const Icon = cfg?.Icon ?? Layers;
              const active = activeType === type;
              return (
                <button
                  key={type}
                  onClick={() => handleTypeClick(type)}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 border',
                    active
                      ? 'bg-white text-[#0a0a0a] border-transparent shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                      : 'bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white/70 hover:bg-white/[0.06]'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {type === 'ALL' ? 'All Types' : typeLabel(type)}
                </button>
              );
            })}
            <span className="ml-auto text-[11px] font-bold text-white/20">
              {loading ? '—' : `${filtered.length} model${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200">
            <div className="text-sm font-bold">Failed to load catalog</div>
            <div className="mt-1 text-sm opacity-70">{error}</div>
          </div>
        )}

        {/* ── Skeletons ── */}
        {loading && (
          <div className="space-y-10">
            {[1, 2].map(g => (
              <div key={g} className="space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/[0.06]" />
                  <Skeleton className="h-7 w-28 rounded-xl" />
                  <div className="h-px flex-1 bg-white/[0.06]" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
              <Car className="h-7 w-7 text-white/15" />
            </div>
            <div>
              <div className="text-sm font-bold text-white/40">No vehicles found</div>
              <div className="mt-1 text-xs text-white/20">
                {search ? `No results for "${search}".` : 'The catalog is empty.'}
              </div>
            </div>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs font-bold text-[var(--accent)] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {/* ── Grouped content ── */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-14">
            {Object.entries(grouped).map(([vehicleType, makeGroups]) => {
              const cfg = TYPE_CONFIG[vehicleType];
              const TypeIcon = cfg?.Icon ?? Car;
              const iconColor = cfg?.color ?? 'text-white/50';
              const totalModels = Object.values(makeGroups).flat().length;

              return (
                <section key={vehicleType}>
                  <div className="flex items-center gap-3 mb-7">
                    <div className="h-9 w-9 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                      <TypeIcon className={cn('h-4 w-4', iconColor)} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-black uppercase tracking-[0.25em] text-white/25">Category</div>
                      <h2 className="text-[18px] font-black text-white leading-tight">{typeLabel(vehicleType)}</h2>
                    </div>
                    <span className="ml-auto text-[11px] font-bold text-white/20 flex-shrink-0">
                      {totalModels} model{totalModels !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-7">
                    {Object.entries(makeGroups).map(([make, cars]) => (
                      <BrandSection key={make} make={make} vehicles={cars} onOpenVehicle={setSelectedVehicle} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail viewer ── */}
      {selectedVehicle && (
        <VehicleDetailViewer
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          onUpdate={(updatedAsset) => {
            setVehicles(prev => prev.map(v => {
              if (v.id === selectedVehicle.id) {
                return {
                  ...v,
                  images: v.images.map(img => img.id === updatedAsset.id ? updatedAsset : img)
                };
              }
              return v;
            }));
            setSelectedVehicle(prev => {
              if (!prev) return null;
              return {
                ...prev,
                images: (prev.images || []).map(img => img.id === updatedAsset.id ? updatedAsset : img)
              };
            });
          }}
          onAdd={(newAsset) => {
            setVehicles(prev => prev.map(v => {
              if (v.id === selectedVehicle.id) {
                return { ...v, images: [...v.images, newAsset] };
              }
              return v;
            }));
            setSelectedVehicle(prev => {
              if (!prev) return null;
              return { ...prev, images: [...prev.images, newAsset] };
            });
          }}
        />
      )}

      {isAddModalOpen && (
        <AddVehicleModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={(newVehicle) => {
            if (newVehicle && newVehicle.id) {
              setVehicles(prev => [...prev, newVehicle]);
            }
            setIsAddModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Vehicle Detail Viewer Component ──────────────────────────────────────────
function VehicleDetailViewer({
  vehicle,
  onClose,
  onUpdate,
  onAdd,
}: {
  vehicle: CatalogVehicle;
  onClose: () => void;
  onUpdate: (updatedAsset: any) => void;
  onAdd: (newAsset: any) => void;
}) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const hasNoImages = (vehicle.images?.length ?? 0) === 0;
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const images = (vehicle.images?.length ?? 0) > 0 ? (vehicle.images as any[]) : [{ id: 'na', assetUrl: '', type: 'HERO', assetIndex: 0 }];
  const currentImg = images[activeImgIdx];
  const [failed, setFailed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNext = () => setActiveImgIdx(p => (p + 1) % images.length);
  const handlePrev = () => setActiveImgIdx(p => (p - 1 + images.length) % images.length);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      setIsUploading(true);
      if (hasNoImages || currentImg.id === 'na') {
        const res = await adminApi.createCatalogVehicleAsset(vehicle.id, file, 'HERO');
        if (res.success) {
          onAdd(res.data);
          setFailed(false);
        } else {
          alert(res.error.message || 'Failed to upload image');
        }
      } else {
        const res = await adminApi.updateCatalogVehicleAsset(vehicle.id, currentImg.id, file);
        if (res.success) {
          onUpdate(res.data);
          setFailed(false);
        } else {
          alert(res.error.message || 'Failed to upload image');
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const cfg = TYPE_CONFIG[vehicle.vehicleType];
  const TypeIcon = cfg?.Icon ?? Car;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-2xl animate-in fade-in duration-500" onClick={onClose} />

      <div className="relative w-full max-w-6xl h-full max-h-[90vh] bg-[#0c0c0e]/95 border border-white/[0.08] rounded-[2.5rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] z-50 animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-white/[0.1] flex items-center justify-between bg-black/20 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)]">
              <TypeIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white tracking-tight uppercase">{vehicle.make}</h2>
                <span className="text-xl font-black text-[var(--accent)] tracking-tight">{vehicle.model}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{vehicle.variant || 'Standard Variant'}</span>
                <span className="text-white/10">•</span>
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{vehicle.vehicleType}</span>
                <span className="text-white/10">•</span>
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{vehicle.normalizedKey}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all shadow-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden bg-black/40 flex items-center justify-center p-6 lg:p-12 relative group/viewer">
          <div className="relative w-full h-full flex items-center justify-center">
            {currentImg.assetUrl && !failed ? (
              <img
                key={currentImg.id}
                src={currentImg.assetUrl}
                alt={`${vehicle.model} ${currentImg.type}`}
                onError={() => setFailed(true)}
                className={cn(
                  "max-w-full max-h-full object-contain rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-500",
                  isUploading && "opacity-50 blur-sm"
                )}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 text-white/10">
                <ImageOff className="h-24 w-24" />
                <p className="font-black uppercase tracking-[0.3em] text-sm">Image Unavailable</p>
              </div>
            )}

            {isAdmin && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/viewer:opacity-100 transition-opacity">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                <Button variant="secondary" className="rounded-full h-14 px-6 border-white/20 bg-black/40 backdrop-blur-md hover:bg-black/60 shadow-2xl" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                  {isUploading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : hasNoImages || failed ? <Upload className="h-5 w-5 mr-2" /> : <Edit2 className="h-5 w-5 mr-2" />}
                  {isUploading ? 'Uploading…' : hasNoImages || failed ? 'Upload Image' : 'Replace Image'}
                </Button>
              </div>
            )}

            {images.length > 1 && (
              <>
                <button onClick={handlePrev} className="absolute left-0 h-16 w-16 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-black/60 transition-all -translate-x-1/2 opacity-0 group-hover/viewer:opacity-100 group-hover/viewer:translate-x-0"><ChevronLeft className="h-8 w-8" /></button>
                <button onClick={handleNext} className="absolute right-0 h-16 w-16 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-black/60 transition-all translate-x-1/2 opacity-0 group-hover/viewer:opacity-100 group-hover/viewer:translate-x-0"><ChevronRight className="h-8 w-8" /></button>
              </>
            )}
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-[10px] font-black text-white/40 uppercase tracking-widest">
            <span>{currentImg.type || 'ASSET'}</span>
            <span className="w-px h-3 bg-white/10" />
            <span>{activeImgIdx + 1} / {images.length}</span>
          </div>
        </div>

        <div className="px-8 py-5 bg-black/60 border-t border-white/[0.05] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {images.map((img, idx) => (
              <button key={img.id} onClick={() => { setActiveImgIdx(idx); setFailed(false); }} className={cn("h-12 w-20 rounded-lg overflow-hidden border transition-all duration-300", activeImgIdx === idx ? "border-[var(--accent)] scale-110 shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]" : "border-white/10 opacity-40 hover:opacity-100")}>
                {img.assetUrl ? <img src={img.assetUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-white/5 flex items-center justify-center"><ImageOff className="h-4 w-4" /></div>}
              </button>
            ))}
          </div>
          <div className="flex flex-col items-end text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
            <span>System Index ID: {vehicle.id}</span>
            <span className="mt-1 text-[var(--accent)]/40">Gupio Fleet Insight v2.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Vehicle Modal Component ──────────────────────────────────────────────
function AddVehicleModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (v: CatalogVehicle) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    make: '',
    model: '',
    type: 'CAR',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;
    setFiles(prev => [...prev, ...newFiles]);
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    setFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.make || !form.model || files.length === 0) {
      alert('Make, Model, and at least one image are required');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('make', form.make);
      formData.append('model', form.model);
      formData.append('type', form.type);
      files.forEach((file, index) => {
        formData.append('images', file);
        formData.append('imageTypes', index === 0 ? 'HERO' : 'ANGLE');
      });

      const res = await adminApi.createCatalogVehicle(formData);
      if (res.success) onSuccess(res.data);
      else alert(res.error.message || 'Failed to create vehicle');
    } catch (err) {
      console.error('Create error:', err);
      alert('An error occurred during creation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[#0c0c0e] border border-white/[0.08] rounded-[2rem] shadow-2xl z-50 animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Add New Vehicle</h2>
            <p className="text-xs text-white/40 mt-1 font-medium tracking-wide">Expand the global vehicle library</p>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar max-h-[70vh]">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Vehicle Make</label>
              <input required placeholder="e.g. Maruti Suzuki" value={form.make} onChange={e => setForm(p => ({ ...p, make: e.target.value }))} className="h-11 w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-white placeholder:text-white/10 outline-none focus:border-[var(--accent)]/40 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Vehicle Model</label>
              <input required placeholder="e.g. Swift" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} className="h-11 w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 text-sm text-white placeholder:text-white/10 outline-none focus:border-[var(--accent)]/40 transition-all" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Vehicle Type</label>
            <div className="flex gap-2">
              {['CAR', 'BIKE', 'COMMERCIAL'].map(t => (
                <button key={t} type="button" onClick={() => setForm(p => ({ ...p, type: t }))} className={cn("flex-1 h-11 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all", form.type === t ? "bg-white text-black border-transparent shadow-[0_0_20px_rgba(255,255,255,0.1)]" : "bg-white/[0.02] border-white/[0.08] text-white/30 hover:bg-white/[0.05]")}>{t}</button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Vehicle Images</label>
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">* First image becomes HERO</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {previews.map((url, i) => (
                <div key={url} className="relative aspect-video rounded-xl overflow-hidden border border-white/10 group">
                  <img src={url} className="w-full h-full object-cover" alt="" />
                  <button type="button" onClick={() => removeFile(i)} className="absolute top-1 right-1 h-6 w-6 rounded-lg bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                  {i === 0 && <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-[var(--accent)] text-black text-[8px] font-black uppercase">HERO</div>}
                </div>
              ))}
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-video rounded-xl border-2 border-dashed border-white/[0.05] bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-white/20 hover:text-white/40 hover:bg-white/[0.03] transition-all"><Plus className="h-5 w-5" /><span className="text-[9px] font-black uppercase tracking-widest">Add more</span></button>
            </div>
            <input type="file" ref={fileInputRef} multiple accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        </form>

        <div className="p-6 bg-black/40 border-t border-white/[0.05]">
          <Button type="submit" onClick={handleSubmit} disabled={loading || !form.make || !form.model || files.length === 0} className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90 font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Car className="h-5 w-5" />}{loading ? 'Creating Entry...' : 'Create Catalog Entry'}</Button>
        </div>
      </div>
    </div>
  );
}
