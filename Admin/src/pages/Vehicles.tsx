import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  flexRender,
} from '@tanstack/react-table';
import { Search, CarFront, ChevronUp, ChevronDown, ShieldCheck, ShieldAlert, BadgeInfo, ListFilter } from 'lucide-react';
import CountUp from '../components/ui/CountUp/CountUp';
import { adminApi, type AdminVehicleListItem } from '../api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

const PAGE_SIZE = 20;

export default function Vehicles() {
  const navigate = useNavigate();
  const [data, setData] = useState<{
    data: AdminVehicleListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 250);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    adminApi.listVehicles({ 
      page, 
      limit: PAGE_SIZE, 
      search: debouncedSearch || undefined,
      type: typeFilter || undefined
    }).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success) setData(res.data);
      else setError(res.error.message);
    });
    return () => {
      ignore = true;
    };
  }, [page, debouncedSearch, typeFilter]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClose = () => setIsFilterOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const rows = useMemo(() => data?.data ?? [], [data]);

  const columns = useMemo<ColumnDef<AdminVehicleListItem>[]>(
    () => [
      {
        id: 'registration',
        header: 'Registration',
        accessorFn: (r) => r.registrationNumber,
        cell: ({ row }) => {
          const v = row.original;
          return (
            <div>
              <div className="font-bold text-white tracking-widest uppercase">{v.registrationNumber}</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                {v.rcVerified ? (
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                ) : (
                  <ShieldAlert className="h-3 w-3 text-white/30" />
                )}
                <span className={cn("text-[10px] font-medium uppercase", v.rcVerified ? "text-emerald-400/80" : "text-white/40")}>
                  {v.rcVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'vehicle',
        header: 'Vehicle Details',
        accessorFn: (r) => `${r.make} ${r.model}`,
        cell: ({ row }) => {
          const v = row.original;
          return (
            <div>
              <div className="font-semibold text-white/90">{v.make} {v.model}</div>
              <div className="text-[11px] text-white/45">
                {v.year ? `${v.year} · ` : ''}{v.fuelType || 'Unknown fuel'}{v.variant ? ` · ${v.variant}` : ''}
              </div>
            </div>
          );
        },
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorFn: (r) => r.customer?.fullName || r.ownerName,
        cell: ({ row }) => {
          const v = row.original;
          if (!v.customer) return <span className="text-white/30">—</span>;
          return (
            <div className="block">
              <div className="font-medium text-white/80">{v.customer.fullName || v.ownerName || 'Unnamed Owner'}</div>
              <div className="text-[10px] text-white/40">{v.customer.phoneNumber}</div>
            </div>
          );
        },
      },
      {
        id: 'type',
        header: 'Type',
        accessorFn: (r) => r.vehicleType,
        cell: ({ row }) => (
          <span className="text-xs text-white/60">{row.original.vehicleType || '—'}</span>
        ),
      },
      {
        id: 'stats',
        header: 'Stats',
        cell: ({ row }) => {
          const c = row.original._count;
          return (
            <div className="flex gap-3 text-[10px] uppercase font-bold tracking-tight text-white/40">
              <div className="flex flex-col">
                <span className="text-white/70">{c.expenses}</span>
                <span>Exp</span>
              </div>
              <div className="flex flex-col">
                <span className="text-white/70">{c.challans}</span>
                <span>Challan</span>
              </div>
              <div className="flex flex-col">
                <span className="text-white/70">{c.documents}</span>
                <span>Docs</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.isActive,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <div className={cn("h-1.5 w-1.5 rounded-full", row.original.isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-white/20")} />
            <span className={cn("text-[10px] font-bold uppercase tracking-wider", row.original.isActive ? "text-emerald-400" : "text-white/30")}>
              {row.original.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="animate-in fade-in slide-in-from-left duration-500">
          <h1 className="text-[28px] font-black tracking-tight text-white leading-none">Fleet Management</h1>
          <p className="mt-2 text-sm text-white/40 font-medium">Monitor and verify all customer vehicles across the platform</p>
        </div>
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right duration-500" onClick={(e) => e.stopPropagation()}>
          {/* Vehicle Type Filter Dropdown */}
          <div className="relative">
            <Button
              variant="secondary"
              className={cn(
                "h-10 px-4 rounded-xl flex items-center gap-2 transition-all duration-300",
                typeFilter 
                  ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.1)]"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white"
              )}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <ListFilter className="h-4 w-4" />
              <span className="text-sm font-bold capitalize">
                {typeFilter === 'BIKE' ? '2 Wheelers' : typeFilter === 'CAR' ? '4 Wheelers' : 'All Types'}
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", isFilterOpen && "rotate-180")} />
            </Button>

            {isFilterOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-white/10 bg-[#0c0c0e]/95 backdrop-blur-xl shadow-2xl z-[60] p-1.5 animate-in zoom-in-95 fade-in duration-200">
                <button
                  onClick={() => { setTypeFilter(null); setIsFilterOpen(false); setPage(1); }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all mb-1",
                    !typeFilter ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"
                  )}
                >
                  All Vehicles
                </button>
                <button
                  onClick={() => { setTypeFilter('BIKE'); setIsFilterOpen(false); setPage(1); }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all mb-1",
                    typeFilter === 'BIKE' ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "text-white/40 hover:text-white/70 hover:bg-white/5"
                  )}
                >
                  2 Wheelers (Bike)
                </button>
                <button
                  onClick={() => { setTypeFilter('CAR'); setIsFilterOpen(false); setPage(1); }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all",
                    typeFilter === 'CAR' ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "text-white/40 hover:text-white/70 hover:bg-white/5"
                  )}
                >
                  4 Wheelers (Car)
                </button>
              </div>
            )}
          </div>

          <div className="relative w-full max-w-[420px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="search"
              placeholder="Search by reg number, model, owner…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/20 focus:ring-4 focus:ring-white/[0.02] transition-all"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200 animate-in zoom-in-95 duration-300">
          <div className="text-sm font-bold uppercase tracking-widest">System Error</div>
          <div className="mt-1 text-sm opacity-80">{error}</div>
        </div>
      )}

      {/* Stats row - Horizontal scroll on mobile */}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-1 -mx-4 px-4 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0 md:mx-0 md:px-0 custom-scrollbar-hide">
        <Card className="flex-shrink-0 w-[80%] snap-center bg-emerald-500/[0.03] border-emerald-500/10 hover:bg-emerald-500/[0.05] transition-all md:w-auto">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-500/70">Compliance</div>
                <p className="text-[11px] text-white/40 font-medium leading-none mt-1 whitespace-nowrap">Fleet-wide Status</p>
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400 tracking-tighter">
              <CountUp to={94.2} duration={1.5} formatter={(v) => `${v.toFixed(1)}%`} />
            </div>
          </CardContent>
        </Card>

        <Card className="flex-shrink-0 w-[80%] snap-center bg-blue-500/[0.03] border-blue-500/10 hover:bg-blue-500/[0.05] transition-all md:w-auto">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                <CarFront className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-blue-500/70">Active</div>
                <p className="text-[11px] text-white/40 font-medium leading-none mt-1 whitespace-nowrap">Activity Score</p>
              </div>
            </div>
            <div className="text-2xl font-black text-blue-400 tracking-tighter">
              <CountUp to={88.7} duration={1.5} formatter={(v) => `${v.toFixed(1)}%`} />
            </div>
          </CardContent>
        </Card>

        <Card className="flex-shrink-0 w-[80%] snap-center bg-indigo-500/[0.03] border-indigo-500/10 hover:bg-indigo-500/[0.05] transition-all md:w-auto">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                <BadgeInfo className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500/70">Health</div>
                <p className="text-[11px] text-white/40 font-medium leading-none mt-1 whitespace-nowrap">Performance Grade</p>
              </div>
            </div>
            <div className="text-2xl font-black text-indigo-400 tracking-tighter">A+</div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CarFront className="h-4 w-4 text-[var(--accent)]" />
            Registered Vehicles
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} total vehicles` : '—'} · Showing {rows.length} results
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[#0c0c0e]">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/50 bg-[#111]">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="px-5 py-4"
                      >
                        <div
                          className={cn(
                            'flex items-center gap-1',
                            h.column.getCanSort() && 'cursor-pointer select-none hover:text-white/80'
                          )}
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getCanSort() && (
                            <span className="text-white/40">
                              {h.column.getIsSorted() === 'asc' ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : h.column.getIsSorted() === 'desc' ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <span className="inline-block h-4 w-4" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading && (
                  <>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <TableRowSkeleton key={i} cols={table.getAllLeafColumns().length} />
                    ))}
                  </>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={table.getAllLeafColumns().length} className="p-0">
                      <EmptyState
                        icon={<CarFront className="h-6 w-6" />}
                        title="No vehicles found"
                        description={
                          debouncedSearch
                            ? 'Adjust your search terms to find what you are looking for.'
                            : 'Vehicles registered by your customers will appear here.'
                        }
                        className="rounded-none border-0 bg-transparent py-16"
                      />
                    </td>
                  </tr>
                )}
                {!loading &&
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-white/[0.07] transition-colors hover:bg-white/[0.04] group",
                        row.original.customer && "cursor-pointer"
                      )}
                      onClick={() => {
                        if (row.original.customer) {
                          navigate(`/customers/${row.original.customer.id}`, { state: { activeTab: 'vehicles', sourceContext: 'vehicles' } });
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-5 py-5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 border-t border-white/[0.07] px-5 py-4">
              <div className="text-sm text-white/50">
                Page <span className="text-white font-medium">{page}</span> of{' '}
                <span className="text-white font-medium">{data.pagination.totalPages}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
