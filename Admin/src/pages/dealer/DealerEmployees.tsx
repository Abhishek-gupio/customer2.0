import { Fragment, useEffect, useState } from 'react';
import { Plus, Users, MapPin } from 'lucide-react';
import { dealerApi, type DealerEmployee, type DealerListing } from '../../api/dealerClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { CredentialsRevealBanner } from '../../components/CredentialsRevealBanner';
import { formatDate } from '../../lib/dateUtils';
import { cn } from '../../lib/cn';

const emptyForm = { name: '', phoneNumber: '', password: '', listingIds: [] as string[] };

export default function DealerEmployees() {
  const [employees, setEmployees] = useState<DealerEmployee[]>([]);
  const [listings, setListings] = useState<DealerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdCreds, setCreatedCreds] = useState<{ phoneNumber: string; password: string } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingListingsId, setEditingListingsId] = useState<string | null>(null);
  const [editingSelection, setEditingSelection] = useState<string[]>([]);
  const [savingListings, setSavingListings] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([dealerApi.listEmployees(), dealerApi.listListings()]).then(([empRes, listingRes]) => {
      setLoading(false);
      if (empRes.success) setEmployees(empRes.data);
      else setError(empRes.error.message);
      if (listingRes.success) setListings(listingRes.data);
    });
  };

  useEffect(load, []);

  const toggleFormListing = (listingId: string) => {
    setForm((prev) => ({
      ...prev,
      listingIds: prev.listingIds.includes(listingId)
        ? prev.listingIds.filter((id) => id !== listingId)
        : [...prev.listingIds, listingId],
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.phoneNumber || form.password.length < 8) {
      setError('Name, phone number, and an 8+ character password are required.');
      return;
    }
    setSubmitting(true);
    const res = await dealerApi.createEmployee(form);
    setSubmitting(false);
    if (res.success) {
      setCreatedCreds({ phoneNumber: form.phoneNumber, password: form.password });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } else {
      setError(res.error.message);
    }
  };

  const handleToggleActive = async (employee: DealerEmployee) => {
    setTogglingId(employee.id);
    const res = await dealerApi.setEmployeeActive(employee.id, !employee.isActive);
    setTogglingId(null);
    if (res.success) {
      setEmployees((prev) => prev.map((e) => (e.id === employee.id ? res.data : e)));
    } else {
      setError(res.error.message);
    }
  };

  const startEditingListings = (employee: DealerEmployee) => {
    setEditingListingsId(employee.id);
    setEditingSelection(employee.assignedListings.map((l) => l.id));
  };

  const toggleEditingListing = (listingId: string) => {
    setEditingSelection((prev) => (prev.includes(listingId) ? prev.filter((id) => id !== listingId) : [...prev, listingId]));
  };

  const saveEditingListings = async (employeeId: string) => {
    setSavingListings(true);
    const res = await dealerApi.setEmployeeListings(employeeId, editingSelection);
    setSavingListings(false);
    if (res.success) {
      setEmployees((prev) => prev.map((e) => (e.id === employeeId ? res.data : e)));
      setEditingListingsId(null);
    } else {
      setError(res.error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Employees</h1>
          <p className="text-sm text-white/60">Staff who can mark walk-in occupancy at your lots — they can't edit listings or rates</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4 mr-1" />
          {showForm ? 'Cancel' : 'Add employee'}
        </Button>
      </div>

      {createdCreds && (
        <CredentialsRevealBanner noun="Employee" phoneNumber={createdCreds.phoneNumber} password={createdCreds.password} />
      )}

      {showForm && (
        <Card className="bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/30">
          <CardHeader className="border-b border-white/[0.04] bg-white/[0.01]">
            <CardTitle className="text-lg font-bold">New employee</CardTitle>
            <CardDescription className="text-white/40">They'll sign in at /partner-portal with the phone number and password below</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Field label="Name">
                  <input className={inputClass} placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Phone number">
                  <input className={inputClass} placeholder="e.g. 9876543210" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
                </Field>
                <Field label="Temporary password (min 8 chars)">
                  <input type="text" placeholder="Minimum 8 chars" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </Field>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/50">
                  Which lot(s) can they work?
                </label>
                {listings.length === 0 ? (
                  <p className="text-sm font-semibold text-white/40 bg-white/[0.02] p-4 rounded-xl border border-white/[0.04]">Add a listing first before assigning employees to it.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 p-1 bg-white/[0.02] rounded-xl border border-white/[0.04] inline-flex">
                    {listings.map((listing) => {
                      const selected = form.listingIds.includes(listing.id);
                      return (
                        <button
                          key={listing.id}
                          type="button"
                          onClick={() => toggleFormListing(listing.id)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-300',
                            selected
                              ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                              : 'text-white/40 hover:text-white hover:bg-white/[0.04]',
                          )}
                        >
                          <MapPin className="h-4 w-4" />
                          {listing.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {error && <p className="text-sm font-semibold text-red-400">{error}</p>}
              <Button type="submit" disabled={submitting} className="h-12 w-full md:w-auto font-bold px-8">
                {submitting ? 'Creating…' : 'Create employee'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="bg-[#18181b]/80 border-white/[0.04] backdrop-blur-xl shadow-lg shadow-black/30">
        <CardHeader className="border-b border-white/[0.04] bg-white/[0.01]">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)]/10">
              <Users className="h-4 w-4 text-[var(--accent)]" />
            </div>
            Your employees
          </CardTitle>
          <CardDescription className="text-white/40">{employees.length} total staff members</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 text-sm font-medium text-white/40">Loading…</div>
          ) : employees.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No employees yet" description="Add your on-ground staff so they can mark walk-in occupancy." />
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-white/[0.04] text-xs font-bold uppercase tracking-widest text-white/30 bg-white/[0.01]">
                  <th className="px-5 py-4 rounded-tl-xl">Name</th>
                  <th className="px-5 py-4">Phone</th>
                  <th className="px-5 py-4">Lots</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Added</th>
                  <th className="px-5 py-4 rounded-tr-xl" />
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <Fragment key={emp.id}>
                    <tr className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-4 text-sm font-bold text-white flex items-center gap-2">
                        {emp.name}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-white/70">{emp.phoneNumber}</td>
                      <td className="px-5 py-4 text-sm font-medium text-white/70">
                        {emp.assignedListings.length === 0 ? (
                          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Not assigned</span>
                        ) : (
                          emp.assignedListings.map((l) => l.name).join(', ')
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest',
                            emp.isActive
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-red-500/10 text-red-400',
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', emp.isActive ? 'bg-emerald-500' : 'bg-red-500')}></span>
                          {emp.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-white/50">{formatDate(emp.createdAt)}</td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => (editingListingsId === emp.id ? setEditingListingsId(null) : startEditingListings(emp))}
                          className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors mr-4"
                        >
                          Edit lots
                        </button>
                        <button
                          onClick={() => handleToggleActive(emp)}
                          disabled={togglingId === emp.id}
                          className="text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors disabled:opacity-40"
                        >
                          {emp.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                    {editingListingsId === emp.id && (
                      <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                        <td colSpan={6} className="px-5 py-6">
                          <div className="flex flex-wrap items-center gap-2 p-1 bg-[#18181b] rounded-xl border border-white/[0.04] inline-flex">
                            {listings.map((listing) => {
                              const selected = editingSelection.includes(listing.id);
                              return (
                                <button
                                  key={listing.id}
                                  type="button"
                                  onClick={() => toggleEditingListing(listing.id)}
                                  className={cn(
                                    'flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-300',
                                    selected
                                      ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                                      : 'text-white/40 hover:text-white hover:bg-white/[0.04]',
                                  )}
                                >
                                  <MapPin className="h-3.5 w-3.5" />
                                  {listing.name}
                                </button>
                              );
                            })}
                            <div className="pl-2 flex items-center gap-2 border-l border-white/[0.04] ml-2">
                              <Button
                                onClick={() => saveEditingListings(emp.id)}
                                disabled={savingListings}
                                className="h-9 px-4 text-[11px] font-bold"
                              >
                                {savingListings ? 'Saving…' : 'Save'}
                              </Button>
                              <button
                                onClick={() => setEditingListingsId(null)}
                                className="text-[11px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors px-2"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded-xl bg-white/[0.05] border border-white/10 px-3 text-sm text-white placeholder:text-white/30 focus:border-[var(--accent)]/50 focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">{label}</label>
      {children}
    </div>
  );
}
