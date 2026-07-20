import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { formatDate } from '../../lib/dateUtils';
import { partnerApi, type WashJob, type WashTechnician } from '../../api/carwashPartnerClient';
import { Card, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { cn } from '../../lib/cn';

const STATUS_STYLE: Record<WashJob['status'], string> = {
  CONFIRMED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  TECHNICIAN_ASSIGNED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  IN_PROGRESS: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  REFUNDED: 'bg-white/5 text-white/40 border-white/10',
};

export default function PartnerJobs() {
  const [jobs, setJobs] = useState<WashJob[]>([]);
  const [technicians, setTechnicians] = useState<WashTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([partnerApi.listJobs(), partnerApi.listTechnicians()]).then(([jobsRes, techRes]) => {
      setLoading(false);
      if (jobsRes.success) setJobs(jobsRes.data);
      else setError(jobsRes.error.message);
      if (techRes.success) setTechnicians(techRes.data);
    });
  };

  useEffect(load, []);

  const handleAssign = async (jobId: string, technicianId: string) => {
    if (!technicianId) return;
    setAssigningId(jobId);
    const res = await partnerApi.assignTechnician(jobId, technicianId);
    setAssigningId(null);
    if (res.success) load();
    else setError(res.error.message);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Jobs</h1>
        <p className="text-sm text-white/60">Across all your wash centers and doorstep bookings</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No jobs yet" description="Confirmed bookings will show up here." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/60">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Technician</th>
                  <th className="px-5 py-3">Booked</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-white/[0.05]">
                    <td className="px-5 py-3 text-sm font-medium">{j.customer.fullName ?? j.customer.phoneNumber}</td>
                    <td className="px-5 py-3 text-sm text-white/70">
                      {j.washType.replace(/_/g, ' ')} · {j.serviceModel === 'DOORSTEP' ? 'Doorstep' : 'Visit center'}
                    </td>
                    <td className="px-5 py-3 text-sm text-white/70">₹{(j.amountPaise / 100).toFixed(0)}</td>
                    <td className="px-5 py-3">
                      <span className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest', STATUS_STYLE[j.status])}>
                        {j.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-white/70">
                      {j.technician ? (
                        j.technician.name
                      ) : j.status === 'CONFIRMED' ? (
                        <select
                          className="h-8 rounded-lg bg-white/[0.05] border border-white/10 px-2 text-xs text-white"
                          disabled={assigningId === j.id}
                          defaultValue=""
                          onChange={(e) => handleAssign(j.id, e.target.value)}
                        >
                          <option value="" disabled>Assign…</option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-white/40">{formatDate(j.createdAt)}</td>
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
