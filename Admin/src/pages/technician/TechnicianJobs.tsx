import { useEffect, useState } from 'react';
import { ClipboardList, Camera, Loader2, CheckCircle2 } from 'lucide-react';
import { technicianApi, type TechnicianJob } from '../../api/carwashTechnicianClient';
import { Card, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/dateUtils';
import { cn } from '../../lib/cn';

const STATUS_STYLE: Record<TechnicianJob['status'], string> = {
  TECHNICIAN_ASSIGNED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  IN_PROGRESS: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function TechnicianJobs() {
  const [jobs, setJobs] = useState<TechnicianJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    technicianApi.listJobs().then((res) => {
      setLoading(false);
      if (res.success) setJobs(res.data);
      else setError(res.error.message);
    });
  };

  useEffect(load, []);

  const handleBeforePhotos = async (jobId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusyId(jobId);
    const res = await technicianApi.uploadBeforePhotos(jobId, Array.from(fileList));
    setBusyId(null);
    if (res.success) load();
    else setError(res.error.message);
  };

  const handleComplete = async (jobId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBusyId(jobId);
    const res = await technicianApi.completeJob(jobId, Array.from(fileList));
    setBusyId(null);
    if (res.success) load();
    else setError(res.error.message);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">My Jobs</h1>
        <p className="text-sm text-white/60">Jobs assigned to you — upload before/after photos as you go</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-white/40">Loading…</div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No jobs assigned yet" description="Your wash partner will assign you jobs as bookings come in." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">{job.customer.fullName ?? job.customer.phoneNumber}</div>
                  <span className={cn('rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest', STATUS_STYLE[job.status])}>
                    {job.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-white/60">
                  {job.washType.replace(/_/g, ' ')} · {job.serviceModel === 'DOORSTEP' ? 'Doorstep' : 'Visit center'}
                </div>
                {job.addressLine && <div className="text-xs text-white/50">{job.addressLine}</div>}
                <div className="text-xs text-white/40">Booked {formatDate(job.createdAt)} · ₹{(job.amountPaise / 100).toFixed(0)}</div>

                {job.beforePhotoUrls.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto">
                    {job.beforePhotoUrls.map((url) => (
                      <img key={url} src={url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover border border-white/10" />
                    ))}
                  </div>
                )}
                {job.afterPhotoUrls.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto">
                    {job.afterPhotoUrls.map((url) => (
                      <img key={url} src={url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover border border-emerald-500/30" />
                    ))}
                  </div>
                )}

                {job.status === 'TECHNICIAN_ASSIGNED' && (
                  <label className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold text-white/70 hover:text-white cursor-pointer transition-colors">
                    {busyId === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {busyId === job.id ? 'Uploading…' : 'Upload before photos & start'}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleBeforePhotos(job.id, e.target.files)} />
                  </label>
                )}
                {job.status === 'IN_PROGRESS' && (
                  <label className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] py-2.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 cursor-pointer transition-colors">
                    {busyId === job.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {busyId === job.id ? 'Uploading…' : 'Upload after photos & complete'}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleComplete(job.id, e.target.files)} />
                  </label>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
