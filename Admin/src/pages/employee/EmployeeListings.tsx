import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Car, Bike, ParkingSquare, Radio } from 'lucide-react';
import { employeeApi } from '../../api/employeeClient';
import type { DealerListing } from '../../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';

const STATUS_STYLE: Record<DealerListing['status'], string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PAUSED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  REMOVED: 'bg-white/5 text-white/40 border-white/10',
};

export default function EmployeeListings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<DealerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    employeeApi.listListings().then((res) => {
      setLoading(false);
      if (res.success) {
        setListings(res.data);
        if (res.data.length === 1) {
          navigate(`/employee/listings/${res.data[0].id}/slots`, { replace: true });
        }
      }
      else setError(res.error.message);
    });
  }, [navigate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">My Lots</h1>
        <p className="text-sm text-white/60">Choose a parking lot to manage gate entry, walk-ins, and availability</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : listings.length === 0 ? (
        <EmptyState icon={<ParkingSquare className="h-6 w-6" />} title="No lots yet" description="Ask your parking lot owner to add a listing first." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <Card
              key={listing.id}
              className="cursor-pointer bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:border-emerald-500/30 transition-all duration-300 overflow-hidden group"
              onClick={() => navigate(`/employee/listings/${listing.id}/slots`)}
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
              <CardContent className="pt-5 pb-5 flex items-center justify-between text-sm text-white/70">
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/employee/listings/${listing.id}/live`);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-2.5 py-1.5 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  <Radio className="h-3.5 w-3.5 animate-pulse" />
                  Live Gate
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
