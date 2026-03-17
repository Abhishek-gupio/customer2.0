import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { adminApi, type CustomerDetail as CustomerDetailType, type AdminVehicleDetail } from '../api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'vehicles' | 'expenses' | 'documents' | 'tickets'>('overview');

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
    return () => {
      ignore = true;
    };
  }, [id]);

  if (loading) return <div className="text-sm text-[var(--accent)]">Loading customer…</div>;
  if (error) {
    return (
      <div className="rounded-2xl border border-[rgba(220,53,69,0.35)] bg-[rgba(220,53,69,0.10)] p-5 text-white">
        <div className="text-sm font-semibold">Error</div>
        <div className="mt-1 text-sm text-white/70">{error}</div>
      </div>
    );
  }
  if (!customer) return null;

  const vehicles = (customer.vehicles ?? []) as AdminVehicleDetail[];
  const expenses = (customer.expenses ?? []) as ExpenseRow[];
  const documents = (customer.documents ?? []) as DocumentRow[];
  const tickets = (customer.supportTickets ?? []) as TicketRow[];
  const displayName = customer.fullName || customer.email || customer.phoneNumber || 'Customer';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Link to="/customers" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline">
          <ArrowLeft className="h-4 w-4" />
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
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setTab('overview')}>Overview</Button>
            <Button variant="secondary" size="sm" onClick={() => setTab('vehicles')}>Vehicles</Button>
            <Button variant="secondary" size="sm" onClick={() => setTab('expenses')}>Expenses</Button>
            <Button variant="secondary" size="sm" onClick={() => setTab('documents')}>Documents</Button>
            <Button variant="secondary" size="sm" onClick={() => setTab('tickets')}>Tickets</Button>
          </div>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4 text-[var(--accent)]" />
                Profile
              </CardTitle>
              <CardDescription>Customer meta + quick counts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 text-sm text-white/70 md:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                  <div className="text-xs font-semibold text-white/50">Customer ID</div>
                  <div className="mt-2 break-all font-semibold text-white">{customer.id}</div>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                  <div className="text-xs font-semibold text-white/50">Created</div>
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
              <CardDescription>{(customer.emergencyContacts as any[])?.length ?? 0} saved</CardDescription>
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
                <div className="text-sm text-white/60">No emergency contacts.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'vehicles' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <CarFront className="h-5 w-5 text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Vehicles ({vehicles?.length ?? 0})</h2>
          </div>
          {vehicles && vehicles.length > 0 ? (
            vehicles.map((v) => <VehicleDetailCard key={v.id} vehicle={v} />)
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-white/60">
                No vehicles available for this role.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === 'expenses' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ReceiptIndianRupee className="h-4 w-4 text-[var(--accent)]" /> Recent expenses</CardTitle>
            <CardDescription>{Array.isArray(expenses) ? expenses.length : 0} items (limited)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.isArray(expenses) && expenses.length > 0 ? expenses.slice(0, 30).map((e) => (
              <div key={e.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">₹{e.amount}</div>
                  <span className="text-xs font-semibold text-white/60">{e.category}</span>
                </div>
                <div className="mt-1 text-sm text-white/55">{e.date ? new Date(e.date).toLocaleString() : ''}</div>
              </div>
            )) : <div className="text-sm text-white/60">No expenses available for this role.</div>}
          </CardContent>
        </Card>
      )}

      {tab === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-[var(--accent)]" /> Documents</CardTitle>
            <CardDescription>{Array.isArray(documents) ? documents.length : 0} documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.isArray(documents) && documents.length > 0 ? documents.map((d) => (
              <div key={d.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">{d.type}</div>
                  <span className="text-xs font-semibold text-white/60">{d.verificationStatus}</span>
                </div>
              </div>
            )) : <div className="text-sm text-white/60">No documents available for this role.</div>}
          </CardContent>
        </Card>
      )}

      {tab === 'tickets' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Ticket className="h-4 w-4 text-[var(--accent)]" /> Support tickets</CardTitle>
            <CardDescription>{Array.isArray(tickets) ? tickets.length : 0} tickets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.isArray(tickets) && tickets.length > 0 ? tickets.map((t) => (
              <div key={t.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">{t.subject}</div>
                  <span className="text-xs font-semibold text-white/60">{t.status} · {t.priority}</span>
                </div>
                <div className="mt-1 text-sm text-white/60">{t.description}</div>
              </div>
            )) : <div className="text-sm text-white/60">No tickets.</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

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
        {/* Basics */}
        <SectionToggle
          title="Vehicle details"
          open={expanded.basics}
          onToggle={() => toggle('basics')}
          icon={CarFront}
        />
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

        {/* Health score */}
        <SectionToggle title="Health score" open={expanded.health} onToggle={() => toggle('health')} icon={Gauge} />
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

        {/* Challans */}
        <SectionToggle
          title={`Challans (${challans.length})`}
          open={expanded.challans}
          onToggle={() => toggle('challans')}
          icon={AlertCircle}
        />
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
                    ₹{c.amount} · {c.status} · {new Date(c.date).toLocaleDateString()}
                    {c.location ? ` · ${c.location}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Vehicle documents */}
        <SectionToggle
          title={`Documents (${documents.length})`}
          open={expanded.documents}
          onToggle={() => toggle('documents')}
          icon={FileText}
        />
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

        {/* Odometer logs */}
        <SectionToggle
          title={`Odometer logs (${odometerLogs.length})`}
          open={expanded.odometer}
          onToggle={() => toggle('odometer')}
          icon={ClipboardList}
        />
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

        {/* Service records */}
        <SectionToggle
          title={`Service records (${serviceRecords.length})`}
          open={expanded.service}
          onToggle={() => toggle('service')}
          icon={Wrench}
        />
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
                      {sr.odometerAtService != null ? ` · ${sr.odometerAtService} km` : ''}
                    </span>
                  </div>
                  {sr.nextServiceDate && (
                    <div className="mt-1 text-xs text-white/50">
                      Next: {new Date(sr.nextServiceDate).toLocaleDateString()}
                      {sr.nextServiceKm != null ? ` / ${sr.nextServiceKm} km` : ''}
                    </div>
                  )}
                  {sr.notes && <div className="mt-1 text-sm text-white/60">{sr.notes}</div>}
                  {sr.parts && sr.parts.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sr.parts.map((p) => (
                        <span key={p.id} className="rounded bg-white/10 px-2 py-1 text-xs">
                          {p.partType} {p.partName ?? ''} {p.cost != null ? `₹${p.cost}` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Telematics */}
        <SectionToggle title="Telematics" open={expanded.telematics} onToggle={() => toggle('telematics')} icon={Route} />
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

        {/* Shared access */}
        <SectionToggle
          title={`Shared access (${accessList.length})`}
          open={expanded.access}
          onToggle={() => toggle('access')}
          icon={Share2}
        />
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

        {/* Driving trips */}
        <SectionToggle
          title={`Driving trips (${drivingTrips.length})`}
          open={expanded.trips}
          onToggle={() => toggle('trips')}
          icon={Route}
        />
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
                    {t.avgSpeed != null ? ` · ${t.avgSpeed} km/h avg` : ''}
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

function SectionToggle({
  title,
  open,
  onToggle,
  icon: Icon,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-left text-sm font-medium hover:bg-white/[0.05]"
    >
      {open ? <ChevronDown className="h-4 w-4 text-[var(--accent)]" /> : <ChevronRight className="h-4 w-4 text-[var(--accent)]" />}
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

type ExpenseRow = {
  id: string;
  amount: number;
  category: string;
  date?: string | null;
};

type DocumentRow = {
  id: string;
  type: string;
  verificationStatus?: string;
};

type TicketRow = {
  id: string;
  subject: string;
  description?: string | null;
  status?: string;
  priority?: string;
};
