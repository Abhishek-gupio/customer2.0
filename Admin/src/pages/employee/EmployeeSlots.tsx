import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarX, Radio } from 'lucide-react';
import { format } from 'date-fns';
import { employeeApi } from '../../api/employeeClient';
import type { DealerSlotWindow } from '../../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';

export default function EmployeeSlots() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [hasMultipleLots, setHasMultipleLots] = useState(false);
  const [listingName, setListingName] = useState('');
  const [windows, setWindows] = useState<DealerSlotWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    employeeApi.listListings().then((res) => {
      if (res.success) {
        if (res.data.length > 1) {
          setHasMultipleLots(true);
        }
        const current = res.data.find((l) => l.id === id);
        if (current) {
          setListingName(current.name);
        }
      }
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    employeeApi.listSlotWindows(id).then((res) => {
      setLoading(false);
      if (res.success) setWindows(res.data);
      else setError(res.error.message);
    });
  }, [id]);

  return (
    <div className="space-y-6">
      {hasMultipleLots && (
        <button onClick={() => navigate('/employee/listings')} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to lots
        </button>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Availability{listingName ? ` — ${listingName}` : ''}
          </h1>
          <p className="text-sm text-white/60">Check walk-in parkings in and out from the Live Gate Entry page</p>
        </div>
        {id && (
          <Button onClick={() => navigate(`/employee/listings/${id}/live`)}>
            <Radio className="h-4 w-4 mr-1" />
            Live Gate Entry
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : windows.length === 0 ? (
        <EmptyState icon={<CalendarX className="h-6 w-6" />} title="No availability set yet" description="Ask your parking lot owner to set up availability for this lot." />
      ) : (
        <Card className="bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/30 overflow-hidden">
          <CardHeader className="border-b border-white/[0.04] bg-white/[0.01]">
            <CardTitle className="text-lg font-bold">Today & upcoming</CardTitle>
            <CardDescription className="text-white/40">Read-only — capacity is set by the lot owner</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-white/[0.04] text-xs font-bold uppercase tracking-widest text-white/30 bg-white/[0.01]">
                  <th className="px-6 py-4 rounded-tl-xl">Date</th>
                  <th className="px-6 py-4">Hours</th>
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
