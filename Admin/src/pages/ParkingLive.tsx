import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, MapPin, ParkingSquare } from 'lucide-react';
import { adminApi } from '../api/client';
import type { LiveListingSummary } from '../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

export default function ParkingLive() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<LiveListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.listParkingLiveListings().then((res) => {
      setLoading(false);
      if (res.success) setListings(res.data);
      else setError(res.error.message);
    });
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Parking Live</h1>
        <p className="text-sm text-white/60">Every listing, right now — app bookings and walk-ins</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : listings.length === 0 ? (
        <EmptyState icon={<ParkingSquare className="h-6 w-6" />} title="No listings yet" description="Live status will show up here once dealers add listings." />
      ) : (
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
              All listings
            </CardTitle>
            <CardDescription>{listings.length} total</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0c0c0e]">
                <tr className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/60">
                  <th className="px-5 py-3">Listing</th>
                  <th className="px-5 py-3">Dealer</th>
                  <th className="px-5 py-3">App bookings</th>
                  <th className="px-5 py-3">Walk-ins</th>
                  <th className="px-5 py-3">Total here</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr
                    key={l.listingId}
                    className="border-b border-white/[0.05] cursor-pointer hover:bg-white/[0.03]"
                    onClick={() => navigate(`/parking-live/${l.listingId}`)}
                  >
                    <td className="px-5 py-4 text-sm font-medium">{l.listingName}</td>
                    <td className="px-5 py-4 text-sm text-white/70">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-white/30" />
                        {l.dealerName} · {l.city}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/70">{l.appCount}</td>
                    <td className="px-5 py-4 text-sm text-white/70">{l.walkInCount}</td>
                    <td className="px-5 py-4 text-sm font-bold text-[var(--accent)]">{l.appCount + l.walkInCount}</td>
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
