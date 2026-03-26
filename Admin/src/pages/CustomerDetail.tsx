import { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  CarFront,
  FileText,
  Phone,
  ReceiptIndianRupee,
  Ticket,
  User,
  Gauge,
  AlertCircle,
  ClipboardList,
  Route,
  Share2,
  Wrench,
  ChevronDown,
  ChevronRight,
  X,
  Download,
  ListFilter,
  Calendar,
} from 'lucide-react';
import { adminApi, type CustomerDetail as CustomerDetailType, type AdminVehicleDetail, type AdminVehicleDocument } from '../api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';

// --- TYPES ---
type ExpenseRow = {
  id: string;
  amount: number;
  category: string;
  date?: string | null;
};

type DocumentRow = AdminVehicleDocument;

type TicketRow = {
  id: string;
  subject: string;
  description?: string | null;
  status?: string;
  priority?: string;
};

// --- SUB-COMPONENTS ---

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-white/50">{label}</div>
        <Icon className="h-4 w-4 text-[var(--accent)]" />
      </div>
      <div className="mt-2 text-xl font-extrabold text-[var(--accent)]">{value}</div>
    </div>
  );
}

function SectionToggle({
  title,
  isOpen,
  onToggle,
  icon: Icon,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-left text-sm font-medium hover:bg-white/[0.05]"
    >
      {isOpen ? <ChevronDown className="h-4 w-4 text-[var(--accent)]" /> : <ChevronRight className="h-4 w-4 text-[var(--accent)]" />}
      <Icon className="h-4 w-4 text-[var(--accent)]" />
      {title}
    </button>
  );
}

function KV({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <div className="text-xs text-white/50">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function VehicleDetailCard({ vehicle: v }: { vehicle: AdminVehicleDetail }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    basics: true,
    health: true,
    challans: false,
    documents: false,
    odometer: false,
    service: false,
    telematics: false,
    access: false,
    trips: false,
  });
  const toggle = (key: string) => setExpanded((s) => ({ ...s, [key]: !s[key] }));

  const challans = Array.isArray(v.challans) ? v.challans : [];
  const documents = Array.isArray(v.documents) ? v.documents : [];
  const odometerLogs = Array.isArray(v.odometerLogs) ? v.odometerLogs : [];
  const serviceRecords = Array.isArray(v.serviceRecords) ? v.serviceRecords : [];
  const accessList = Array.isArray(v.accessList) ? v.accessList : [];
  const drivingTrips = Array.isArray(v.drivingTrips) ? v.drivingTrips : [];
  const health = v.healthScore;
  const telematics = v.telematicsDevice;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {v.imageUrl && (
              <img src={v.imageUrl} alt="" className="h-12 w-16 rounded-lg object-cover" />
            )}
            <div>
              <CardTitle className="text-lg">{v.registrationNumber}</CardTitle>
              <CardDescription>
                {[v.make, v.model, v.variant].filter(Boolean).join(' · ')}
                {v.year ? ` · ${v.year}` : ''}
                {v.fuelType ? ` · ${v.fuelType}` : ''}
              </CardDescription>
            </div>
            {v.isPrimary && (
              <span className="rounded-full bg-[var(--accent-dim)] px-2 py-1 text-xs font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]/30">
                Primary
              </span>
            )}
          </div>
          {v._count && (
            <div className="flex gap-2 text-xs text-white/50">
              <span>{v._count.challans} challans</span>
              <span>{v._count.documents} docs</span>
              <span>{v._count.expenses} expenses</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <SectionToggle title="Vehicle details" isOpen={expanded.basics} onToggle={() => toggle('basics')} icon={CarFront} />
        {expanded.basics && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 text-sm md:grid-cols-3">
            <KV label="Variant" value={v.variant} />
            <KV label="Year" value={v.year} />
            <KV label="Fuel" value={v.fuelType} />
            <KV label="Type" value={v.vehicleType} />
            <KV label="Odometer" value={v.currentOdometer != null ? `${v.currentOdometer} km` : null} />
            <KV label="Reg. date" value={v.registrationDate ? new Date(v.registrationDate).toLocaleDateString() : null} />
            <KV label="RC verified" value={v.rcVerified ? 'Yes' : 'No'} />
            <KV label="Chassis" value={v.chassisNumber} />
            <KV label="Engine" value={v.engineNumber} />
          </div>
        )}

        <SectionToggle title="Health score" isOpen={expanded.health} onToggle={() => toggle('health')} icon={Gauge} />
        {expanded.health && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            {health ? (
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                <div>
                  <div className="text-xs text-white/50">Overall</div>
                  <div className="font-semibold text-[var(--accent)]">{health.overallScore}</div>
                </div>
                <KV label="Age" value={health.ageScore} />
                <KV label="Mileage" value={health.mileageScore} />
                <KV label="Maintenance" value={health.maintenanceScore} />
                <KV label="Driving" value={health.drivingScore} />
                <div className="col-span-2 md:col-span-5">
                  <KV label="Next due" value={health.nextDueDate ? new Date(health.nextDueDate).toLocaleDateString() : null} />
                </div>
              </div>
            ) : (
              <div className="text-sm text-white/50">No health score.</div>
            )}
          </div>
        )}

        <SectionToggle title={`Challans (${challans.length})`} isOpen={expanded.challans} onToggle={() => toggle('challans')} icon={AlertCircle} />
        {expanded.challans && (
          <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            {challans.length === 0 ? (
              <div className="text-sm text-white/50">No challans.</div>
            ) : (
              challans.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="font-medium">{c.challanNumber}</span>
                    <span className="ml-2 text-white/60">{c.violationType}</span>
                  </div>
                  <div className="text-sm text-white/70">
                    ₹{c.amount} · {c.status} · {new Date(c.date!).toLocaleDateString()}
                    {c.location ? ` · ${c.location}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <SectionToggle title={`Documents (${documents.length})`} isOpen={expanded.documents} onToggle={() => toggle('documents')} icon={FileText} />
        {expanded.documents && (
          <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            {documents.length === 0 ? (
              <div className="text-sm text-white/50">No documents.</div>
            ) : (
              documents.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <span className="font-medium">{d.type}</span>
                  <span className="text-sm text-white/60">
                    {d.verificationStatus ?? '—'} {d.expiryDate ? `· Exp ${new Date(d.expiryDate).toLocaleDateString()}` : ''}
                    {d.documentNumber ? ` · ${d.documentNumber}` : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        <SectionToggle title={`Odometer logs (${odometerLogs.length})`} isOpen={expanded.odometer} onToggle={() => toggle('odometer')} icon={ClipboardList} />
        {expanded.odometer && (
          <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            {odometerLogs.length === 0 ? (
              <div className="text-sm text-white/50">No odometer logs.</div>
            ) : (
              odometerLogs.map((o) => (
                <div key={o.id} className="flex justify-between text-sm">
                  <span>{o.reading.toLocaleString()} km</span>
                  <span className="text-white/60">{new Date(o.date).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        )}

        <SectionToggle title={`Service records (${serviceRecords.length})`} isOpen={expanded.service} onToggle={() => toggle('service')} icon={Wrench} />
        {expanded.service && (
          <div className="space-y-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            {serviceRecords.length === 0 ? (
              <div className="text-sm text-white/50">No service records.</div>
            ) : (
              serviceRecords.map((sr) => (
                <div key={sr.id} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{sr.serviceType}</span>
                    <span className="text-sm text-white/60">
                      {sr.garageName ?? '—'} · {new Date(sr.serviceDate).toLocaleDateString()}
                    </span>
                  </div>
                  {sr.notes && <div className="mt-1 text-sm text-white/60">{sr.notes}</div>}
                </div>
              ))
            )}
          </div>
        )}

        <SectionToggle title="Telematics" isOpen={expanded.telematics} onToggle={() => toggle('telematics')} icon={Route} />
        {expanded.telematics && (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            {telematics ? (
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <KV label="Instance" value={telematics.instanceId} />
                <KV label="Platform" value={telematics.platform} />
                <KV label="Active" value={telematics.isActive ? 'Yes' : 'No'} />
                <KV label="Last sync" value={telematics.lastSyncAt ? new Date(telematics.lastSyncAt).toLocaleString() : null} />
              </div>
            ) : (
              <div className="text-sm text-white/50">No telematics device.</div>
            )}
          </div>
        )}

        <SectionToggle title={`Shared access (${accessList.length})`} isOpen={expanded.access} onToggle={() => toggle('access')} icon={Share2} />
        {expanded.access && (
          <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            {accessList.length === 0 ? (
              <div className="text-sm text-white/50">Not shared.</div>
            ) : (
              accessList.map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span>{a.customer?.fullName ?? a.customer?.email ?? a.customer?.phoneNumber ?? '—'}</span>
                  <span className="text-white/60">{a.role}</span>
                </div>
              ))
            )}
          </div>
        )}

        <SectionToggle title={`Driving trips (${drivingTrips.length})`} isOpen={expanded.trips} onToggle={() => toggle('trips')} icon={Route} />
        {expanded.trips && (
          <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            {drivingTrips.length === 0 ? (
              <div className="text-sm text-white/50">No trips.</div>
            ) : (
              drivingTrips.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2 text-sm last:border-0 last:pb-0">
                  <span>{new Date(t.startTime).toLocaleString()} → {new Date(t.endTime).toLocaleTimeString()}</span>
                  <span className="text-white/70">
                    {t.distanceKm} km · {Math.round(t.durationMin)} min · Safety {t.safetyScore}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentViewer({ doc, onClose }: { doc: AdminVehicleDocument; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xl animate-in fade-in duration-500" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-[#0c0c0e]/90 border border-white/[0.08] rounded-[2.5rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] z-50 animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-white/[0.1] flex items-center justify-between bg-black/40 backdrop-blur-2xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white capitalize tracking-tight">{doc.type}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{doc.documentNumber || 'No Identifier'}</span>
                {doc.expiryDate && (
                  <>
                    <span className="text-white/10">•</span>
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Expires: {new Date(doc.expiryDate).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {doc.fileUrl ? (
              <Button
                variant="secondary"
                size="sm"
                className="h-10 px-4 rounded-xl border-white/10 hover:bg-white/10"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('adminToken');
                    const response = await fetch(`/api/v1/admin/documents/${doc.id}/download`, {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) throw new Error('Download failed');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${doc.type.replace(/\s+/g, '_')}_${doc.id.slice(0, 8)}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('Download failed:', err);
                    window.open(doc.fileUrl!, '_blank');
                  }
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            ) : null}
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-black/20 flex items-center justify-center p-6 relative">
          {doc.fileUrl ? (
            doc.mimeType?.startsWith('image/') || (!doc.mimeType && doc.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) ? (
              <img src={doc.fileUrl} alt={doc.type} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in fade-in zoom-in-90 duration-500" />
            ) : (
              <iframe src={doc.fileUrl} className="w-full h-full rounded-xl border-none bg-white/[0.02]" title={doc.type} />
            )
          ) : (
            <div className="flex flex-col items-center gap-4 text-white/20">
              <AlertCircle className="h-16 w-16 opacity-10" />
              <div className="flex flex-col items-center">
                <p className="font-extrabold uppercase tracking-[0.3em] text-sm">Preview Unavailable</p>
                <p className="text-[10px] font-medium tracking-widest mt-2">No file associated with this record</p>
              </div>
            </div>
          )}
        </div>
        <div className="px-8 py-4 bg-black/40 border-t border-white/[0.05] flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
          <div className="flex items-center gap-6">
            <span>Verification: {doc.verificationStatus || 'Unknown'}</span>
            <span>ID: {doc.id}</span>
          </div>
          <div>System Insight v2.0</div>
        </div>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const location = useLocation();
  const [tab, setTab] = useState<'overview' | 'vehicles' | 'expenses' | 'documents' | 'tickets'>(location.state?.activeTab || 'overview');
  const [selectedDocument, setSelectedDocument] = useState<AdminVehicleDocument | null>(null);
  const [expenseFilter, setExpenseFilter] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [activeDropdown, setActiveDropdown] = useState<'category' | 'time' | null>(null);

  useEffect(() => {
    if (!id) return;
    let ignore = false;
    setLoading(true);
    adminApi.getCustomer(id).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success) setCustomer(res.data);
      else setError(res.error.message);
    });
    return () => { ignore = true; };
  }, [id]);

  const expenses = (customer?.expenses ?? []) as ExpenseRow[];

  const filteredExpenses = expenses
    .filter(e => (!expenseFilter || e.category === expenseFilter))
    .filter(e => {
      if (timeFilter === 'all') return true;
      if (!e.date) return false;
      const d = new Date(e.date);
      const now = new Date();
      if (timeFilter === 'today') return d.toDateString() === now.toDateString();
      if (timeFilter === 'week') return d >= new Date(new Date().setDate(now.getDate() - 7));
      if (timeFilter === 'month') return d >= new Date(new Date().setMonth(now.getMonth() - 1));
      if (timeFilter === 'year') return d >= new Date(new Date().setFullYear(now.getFullYear() - 1));
      return true;
    });

  const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  if (loading) return <div className="text-sm text-[var(--accent)] p-8">Loading customer profile...</div>;
  if (error) {
    return (
      <div className="m-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-white">
        <div className="text-sm font-semibold">Failed to load customer</div>
        <div className="mt-1 text-sm text-white/70">{error}</div>
      </div>
    );
  }
  if (!customer) return null;

  const vehicles = (customer.vehicles ?? []) as AdminVehicleDetail[];
  const documents = (customer.documents ?? []) as DocumentRow[];
  const tickets = (customer.supportTickets ?? []) as TicketRow[];
  const displayName = customer.fullName || customer.email || customer.phoneNumber || 'Customer';

  const categories = Array.from(new Set(expenses.map(e => e.category))).filter(Boolean);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" onClick={() => setActiveDropdown(null)}>
      {/* Sticky Header Section */}
      <div className="shrink-0 space-y-4 pb-4 bg-[#0c0c0e]/40 backdrop-blur-md rounded-b-[2.5rem] p-6 -mx-6 -mt-6 mb-4 border-b border-white/5 z-20">
        <div className="flex flex-col gap-2">
          <Link 
            to="/customers" 
            className="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 shadow-lg group"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[var(--accent)] group-hover:-translate-x-0.5 transition-transform" />
            Back to customers
          </Link>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{displayName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/60">
                <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" /> {customer.phoneNumber}</span>
                {customer.email && <span>· {customer.email}</span>}
              </div>
            </div>
            
            {/* Glossy Tab Navigation */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              {(['overview', 'vehicles', 'expenses', 'documents', 'tickets'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all duration-300",
                    tab === t
                      ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 shadow-[0_4px_12px_-2px_rgba(var(--accent-rgb),0.2)]"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10 space-y-4">
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[var(--accent)]" />
                  Profile
                </CardTitle>
                <CardDescription>Customer metadata and quick metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 text-sm text-white/70 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                    <div className="text-xs font-semibold text-white/50">Customer ID</div>
                    <div className="mt-2 break-all font-semibold text-white leading-relaxed">{customer.id}</div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                    <div className="text-xs font-semibold text-white/50">Registration Date</div>
                    <div className="mt-2 font-semibold text-white">{new Date(customer.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatPill icon={CarFront} label="Vehicles" value={customer._count.vehicles} />
                  <StatPill icon={ReceiptIndianRupee} label="Expenses" value={customer._count.expenses} />
                  <StatPill icon={FileText} label="Docs" value={customer._count.documents} />
                  <StatPill icon={Ticket} label="Tickets" value={customer._count.supportTickets} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emergency contacts</CardTitle>
                <CardDescription>{(customer.emergencyContacts as any[])?.length ?? 0} saved contacts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {Array.isArray(customer.emergencyContacts) && customer.emergencyContacts.length > 0 ? (
                  (customer.emergencyContacts as any[]).slice(0, 6).map((ec) => (
                    <div key={ec.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                      <div className="font-semibold">{ec.name}</div>
                      <div className="mt-1 text-sm text-white/60">{ec.phoneNumber}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/60 py-4 text-center">No emergency contacts listed.</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'vehicles' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <CarFront className="h-5 w-5 text-[var(--accent)]" />
              <h2 className="text-lg font-semibold">Registered Vehicles ({vehicles?.length ?? 0})</h2>
            </div>
            {vehicles && vehicles.length > 0 ? (
              vehicles.map((v) => <VehicleDetailCard key={v.id} vehicle={v} />)
            ) : (
              <Card>
                <CardContent className="py-20 text-center text-sm text-white/40">
                  No vehicles recorded for this customer yet.
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === 'expenses' && (
          <Card className="flex flex-col min-h-0">
            {/* Sticky Card Header for filters */}
            <CardHeader className="shrink-0 sticky top-0 z-10 bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-white/5 -mx-px -mt-px rounded-t-[1.75rem] py-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2.5 font-black text-white uppercase tracking-tight">
                    <ReceiptIndianRupee className="h-5 w-5 text-[var(--accent)]" /> 
                    Financial Overview
                  </CardTitle>
                  <CardDescription className="font-medium text-white/30 tracking-wide">Analysis of ledger entries</CardDescription>
                </div>

                <div className="flex items-center gap-4">
                  {/* Total Count Glass Pill */}
                  <div className="hidden sm:flex flex-col items-end mr-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Total Expenses</span>
                    <span className="text-xl font-black text-white tracking-tighter">₹{totalExpenses.toLocaleString()}</span>
                  </div>

                  {/* Icon Filters */}
                  <div className="flex items-center gap-2">
                    {/* Category Filter */}
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'category' ? null : 'category'); }}
                        className={cn(
                          "h-10 w-10 flex items-center justify-center rounded-xl border transition-all duration-300",
                          expenseFilter 
                            ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.1)]" 
                            : "bg-white/5 border-white/10 text-white/40 hover:text-white"
                        )}
                        title="Category Filter"
                      >
                        <ListFilter className={cn("h-4.5 w-4.5 transition-transform duration-300", activeDropdown === 'category' && "rotate-180 scale-110")} />
                      </button>
                      
                      {activeDropdown === 'category' && (
                        <div className="absolute right-0 mt-3 w-48 rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl z-50 p-2 animate-in zoom-in-95 duration-200">
                          <button 
                            onClick={() => { setExpenseFilter(null); setActiveDropdown(null); }}
                            className={cn("w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all", !expenseFilter ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70")}
                          >
                            All Categories
                          </button>
                          {categories.map(cat => (
                            <button 
                              key={cat}
                              onClick={() => { setExpenseFilter(cat); setActiveDropdown(null); }}
                              className={cn("w-full text-left px-3 py-2 mt-1 rounded-lg text-xs font-bold transition-all capitalize", expenseFilter === cat ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70")}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Time Filter */}
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'time' ? null : 'time'); }}
                        className={cn(
                          "h-10 w-10 flex items-center justify-center rounded-xl border transition-all duration-300",
                          timeFilter !== 'all' 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                            : "bg-white/5 border-white/10 text-white/40 hover:text-white"
                        )}
                        title="Time Filter"
                      >
                        <Calendar className={cn("h-4.5 w-4.5 transition-transform duration-300", activeDropdown === 'time' && "rotate-180 scale-110")} />
                      </button>

                      {activeDropdown === 'time' && (
                        <div className="absolute right-0 mt-3 w-48 rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl z-50 p-2 animate-in zoom-in-95 duration-200">
                          {(['all', 'today', 'week', 'month', 'year'] as const).map(opt => (
                            <button 
                              key={opt}
                              onClick={() => { setTimeFilter(opt); setActiveDropdown(null); }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all capitalize mb-1 last:mb-0",
                                timeFilter === opt ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                              )}
                            >
                              {opt === 'all' ? 'All Time' : opt === 'week' ? 'Past 7 Days' : opt === 'month' ? 'Past 30 Days' : opt === 'year' ? 'Past Year' : opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Total Display */}
              <div className="mt-4 flex sm:hidden items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Total Expenses</span>
                <span className="text-lg font-black text-white">₹{totalExpenses.toLocaleString()}</span>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-2">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((e) => (
                    <div key={e.id} className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-all">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-extrabold text-lg text-white/90">₹{e.amount.toLocaleString()}</div>
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] font-black text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors">
                          {e.category}
                        </span>
                      </div>
                      <div className="mt-1 text-xs font-medium text-white/30">{e.date ? new Date(e.date).toLocaleString() : 'N/A'}</div>
                    </div>
                  ))
              ) : (
                <div className="text-sm text-white/60 py-10 text-center">No expense records found.</div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'documents' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-[var(--accent)]" /> Compliance Vault</CardTitle>
              <CardDescription>Verified documents and certifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.isArray(documents) && documents.length > 0 ? documents.map((d) => (
                <div
                  key={d.id}
                  className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 cursor-pointer hover:bg-white/[0.06] hover:border-white/10 transition-all active:scale-[0.99]"
                  onClick={() => setSelectedDocument(d)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white group-hover:bg-white/10 transition-all">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-white/90 group-hover:text-white transition-colors capitalize">{d.type}</div>
                        <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-0.5">{d.documentNumber || 'NO IDENTIFIER'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                        d.verificationStatus === 'VERIFIED' ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" : "bg-white/5 text-white/40 border-white/5"
                      )}>
                        {d.verificationStatus || 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>
              )) : <div className="text-sm text-white/60 py-10 text-center">No document records found.</div>}
            </CardContent>
          </Card>
        )}

        {tab === 'tickets' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Ticket className="h-4 w-4 text-[var(--accent)]" /> Assistance Hub</CardTitle>
              <CardDescription>Open assistance requests and history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.isArray(tickets) && tickets.length > 0 ? tickets.map((t) => (
                <div key={t.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-all">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white/90">{t.subject}</div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md border transition-colors",
                        t.status === 'OPEN' ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" :
                        t.status === 'IN_PROGRESS' ? "bg-blue-500/5 text-blue-500 border-blue-500/10" :
                        "bg-white/5 text-white/40 border-white/5"
                      )}>
                        {t.status}
                      </span>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md border transition-colors",
                        t.priority === 'HIGH' || t.priority === 'URGENT' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                        t.priority === 'MEDIUM' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                        "bg-white/5 text-white/40 border-white/5"
                      )}>
                        {t.priority}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-white/50 leading-relaxed">{t.description}</div>
                </div>
              )) : <div className="text-sm text-white/60 py-10 text-center">No active support tickets.</div>}
            </CardContent>
          </Card>
        )}

        {selectedDocument && (
          <DocumentViewer
            doc={selectedDocument}
            onClose={() => setSelectedDocument(null)}
          />
        )}
      </div>
    </div>
  );
}
