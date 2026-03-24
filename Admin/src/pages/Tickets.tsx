import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type ColumnDef,
  type VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  flexRender,
} from '@tanstack/react-table';
import { Search, Ticket, ChevronUp, ChevronDown, MessageSquare } from 'lucide-react';
import { adminApi, type SupportTicketListItem, type TicketStatus, type TicketPriority } from '../api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

const PAGE_SIZE = 20;

export default function Tickets() {
  const navigate = useNavigate();
  const [data, setData] = useState<{
    data: SupportTicketListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const debouncedSearch = useDebouncedValue(search, 250);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    adminApi.listTickets({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }).then((res) => {
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

  const statusColors: Record<TicketStatus, string> = {
    OPEN: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    RESOLVED: 'bg-white/10 text-white/60 border-white/20',
    CLOSED: 'bg-white/5 text-white/40 border-white/10',
  };

  const priorityColors: Record<TicketPriority, string> = {
    LOW: 'text-white/40',
    MEDIUM: 'text-blue-400',
    HIGH: 'text-orange-400',
    URGENT: 'text-red-400 font-bold',
  };

  const columns = useMemo<ColumnDef<SupportTicketListItem>[]>(
    () => [
      {
        id: 'ticket',
        header: 'Ticket',
        accessorFn: (r) => r.subject,
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="max-w-[300px]">
              <div className="font-semibold text-white truncate">{t.subject}</div>
              <div className="mt-1 text-xs text-white/45 truncate">{t.description}</div>
            </div>
          );
        },
      },
      {
        id: 'customer',
        header: 'Reporter',
        accessorFn: (r) => r.customer?.fullName || r.customer?.phoneNumber,
        cell: ({ row }) => {
          const c = row.original.customer;
          if (!c) return <span className="text-white/30">—</span>;
          return (
            <div className="block group-hover:underline">
              <div className="font-medium text-white/80">{c.fullName || 'Unnamed Customer'}</div>
              <div className="text-[10px] text-white/40">{c.phoneNumber}</div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.status,
        cell: ({ row }) => {
          const s = row.original.status;
          return (
            <span className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              statusColors[s]
            )}>
              {s.replace('_', ' ')}
            </span>
          );
        },
      },
      {
        id: 'priority',
        header: 'Priority',
        accessorFn: (r) => r.priority,
        cell: ({ row }) => {
          const p = row.original.priority;
          return (
            <span className={cn("text-[11px] uppercase tracking-wide", priorityColors[p])}>
              {p}
            </span>
          );
        },
      },
      {
        id: 'category',
        header: 'Category',
        accessorFn: (r) => r.category,
        cell: ({ row }) => (
          <span className="text-xs text-white/60">{row.original.category}</span>
        ),
      },
      {
        id: 'messages',
        header: 'Msgs',
        accessorFn: (r) => r._count.messages,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-white/50">
            <MessageSquare className="h-3 w-3" />
            <span className="text-xs">{row.original._count.messages}</span>
          </div>
        ),
      },
      {
        id: 'updatedAt',
        header: 'Last Active',
        accessorFn: (r) => new Date(r.updatedAt).getTime(),
        cell: ({ row }) => (
          <span className="text-[11px] text-white/40">
            {new Date(row.original.updatedAt).toLocaleDateString()}
          </span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Support Tickets</h1>
          <p className="text-sm text-white/60">Manage across-customer support requests and technical issues</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <input
              type="search"
              placeholder="Search tickets or customers…"
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
            <Ticket className="h-4 w-4 text-[var(--accent)]" />
            Active Tickets
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} total cases` : '—'} · Showing {rows.length} results
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
                        style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
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
                        icon={<Ticket className="h-6 w-6" />}
                        title="No tickets found"
                        description={
                          debouncedSearch
                            ? 'Adjust your search terms to find what you are looking for.'
                            : 'Support tickets submitted by customers will appear here.'
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
