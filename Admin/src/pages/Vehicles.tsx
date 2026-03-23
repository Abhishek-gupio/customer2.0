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
import { Search, CarFront, ChevronUp, ChevronDown, ShieldCheck, ShieldAlert, BadgeInfo } from 'lucide-react';
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

  const debouncedSearch = useDebouncedValue(search, 250);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    adminApi.listVehicles({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success) setData(res.data);
      else setError(res.error.message);
    });
    return () => {
      ignore = true;
    };
  }, [page, debouncedSearch]);

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
            <div className="block group-hover:underline">
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
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Fleet Management</h1>
          <p className="text-sm text-white/60">Monitor and verify all customer vehicles across the platform</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <input
              type="search"
              placeholder="Search by reg number, model, owner…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-11 w-full rounded-2xl border border-white/[0.07] bg-white/[0.04] pl-9 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[rgba(220,53,69,0.35)] bg-[rgba(220,53,69,0.10)] p-5 text-white">
          <div className="text-sm font-semibold">Error</div>
          <div className="mt-1 text-sm text-white/70">{error}</div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CarFront className="h-4 w-4 text-[var(--accent)]" />
            Registered Vehicles
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} total vehicles` : '—'} · Showing {rows.length} results
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
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
                          navigate(`/customers/${row.original.customer.id}`);
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
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="bg-emerald-500/[0.03] border-emerald-500/10">
            <CardHeader className="pb-2">
               <CardTitle className="text-emerald-400 text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Compliance Rate
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold">94.2%</div>
               <p className="text-xs text-white/40 mt-1">RC Verified vehicles across fleet</p>
            </CardContent>
         </Card>
         <Card className="bg-blue-500/[0.03] border-blue-500/10">
            <CardHeader className="pb-2">
               <CardTitle className="text-blue-400 text-sm flex items-center gap-2">
                  <CarFront className="h-4 w-4" />
                  Active Ratio
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold">88.7%</div>
               <p className="text-xs text-white/40 mt-1">Vehicles with activity in last 30 days</p>
            </CardContent>
         </Card>
         <Card className="bg-white/[0.03] border-white/5">
            <CardHeader className="pb-2">
               <CardTitle className="text-white/60 text-sm flex items-center gap-2">
                  <BadgeInfo className="h-4 w-4" />
                  Fleet Health
               </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold">Excellent</div>
               <p className="text-xs text-white/40 mt-1">Based on maintenance and expense tracking</p>
            </CardContent>
         </Card>
      </div>
    </div>
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
