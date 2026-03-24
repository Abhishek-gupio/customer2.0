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
import { Search, Users, ChevronUp, ChevronDown, UserCircle } from 'lucide-react';
import { adminApi, type CustomerListItem } from '../api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

const PAGE_SIZE = 20;

export default function Customers() {
  const navigate = useNavigate();
  const [data, setData] = useState<{
    data: CustomerListItem[];
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
    adminApi.listCustomers({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }).then((res) => {
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

  const columns = useMemo<ColumnDef<CustomerListItem>[]>(
    () => [
      {
        id: 'customer',
        header: 'Customer',
        accessorFn: (r) => r.fullName || r.phoneNumber,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-3 group">
               <div className="h-9 w-9 overflow-hidden rounded-full bg-white/[0.03] ring-1 ring-white/10 group-hover:ring-[var(--accent)]/50 transition-all">
                  {c.profilePic ? (
                    <img src={c.profilePic} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/20">
                      <UserCircle className="h-5 w-5" />
                    </div>
                  )}
               </div>
               <div>
                  <div className="font-semibold text-white group-hover:text-[var(--accent)] transition-colors">{c.fullName || 'Unnamed User'}</div>
                  <div className="text-[10px] text-white/40 tracking-tight">{c.phoneNumber}</div>
               </div>
            </div>
          );
        },
      },
      {
         id: 'contact',
         header: 'Contact Info',
         accessorFn: (r) => r.email,
         cell: ({ row }) => (
            <span className="text-xs text-white/60">{row.original.email || '—'}</span>
         )
      },
      {
        id: 'vehicles',
        header: 'Vehicles',
        accessorFn: (r) => r._count.vehicles,
        cell: ({ row }) => {
           const count = row.original._count.vehicles;
           return (
              <div className="flex items-center gap-2">
                 <div className="text-xs font-bold text-white/80">{count}</div>
                 <div className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Vehicles</div>
              </div>
           );
        }
      },
      {
        id: 'expenses',
        header: 'Expenses',
        accessorFn: (r) => r._count.expenses,
        cell: ({ row }) => {
          const count = row.original._count.expenses;
          return (
             <div className="flex items-center gap-2">
                <div className="text-xs font-bold text-white/80">{count}</div>
                <div className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Expenses</div>
             </div>
          );
        },
      },
      {
        id: 'documents',
        header: 'Documents',
        accessorFn: (r) => r._count.documents,
        cell: ({ row }) => {
          const count = row.original._count.documents;
          return (
             <div className="flex items-center gap-2">
                <div className="text-xs font-bold text-white/80">{count}</div>
                <div className="text-[10px] uppercase font-bold text-white/30 tracking-wider">Docs</div>
             </div>
          );
        },
      },
      {
        id: 'joined',
        header: 'Joined',
        accessorFn: (r) => new Date(r.createdAt).getTime(),
        cell: ({ row }) => (
          <span className="text-[11px] text-white/40">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
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
          <h1 className="text-2xl font-extrabold tracking-tight">Customer Directory</h1>
          <p className="text-sm text-white/60">Search and manage user profiles and their associated activity</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <input
              type="search"
              placeholder="Search by name, email, phone…"
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
            <Users className="h-4 w-4 text-[var(--accent)]" />
            Active Users
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} total members` : '—'} · Showing {rows.length} results
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
                        icon={<Users className="h-6 w-6" />}
                        title="No customers found"
                        description={
                          debouncedSearch
                            ? 'Adjust your search terms to find what you are looking for.'
                            : 'Users registered in your app will appear here.'
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
                      className="border-b border-white/[0.07] transition-colors hover:bg-white/[0.04] cursor-pointer"
                      onClick={() => navigate(`/customers/${row.original.id}`)}
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

