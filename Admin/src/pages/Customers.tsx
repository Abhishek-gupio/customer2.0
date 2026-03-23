import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type ColumnDef,
  type VisibilityState,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  flexRender,
} from '@tanstack/react-table';
import { Search, Users, ChevronUp, ChevronDown, Columns } from 'lucide-react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { adminApi, type CustomerListItem } from '../api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Skeleton, TableRowSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

const PAGE_SIZE = 20;

export default function Customers() {
  const [data, setData] = useState<{
    data: CustomerListItem[];
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
        accessorFn: (r) => r.fullName || r.email || r.phoneNumber || r.id,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <Link to={`/customers/${c.id}`} className="block hover:underline">
              <div className="font-semibold">{c.fullName || c.email || c.phoneNumber || c.id}</div>
              <div className="mt-1 text-sm text-white/55">
                {c.phoneNumber}
                {c.email ? ` · ${c.email}` : ''}
              </div>
            </Link>
          );
        },
      },
      {
        id: 'vehicles',
        header: 'Vehicles',
        accessorFn: (r) => r._count.vehicles,
        cell: ({ row }) => row.original._count.vehicles,
      },
      {
        id: 'expenses',
        header: 'Expenses',
        accessorFn: (r) => r._count.expenses,
        cell: ({ row }) => row.original._count.expenses,
      },
      {
        id: 'documents',
        header: 'Documents',
        accessorFn: (r) => r._count.documents,
        cell: ({ row }) => row.original._count.documents,
      },
      {
        id: 'tickets',
        header: 'Tickets',
        accessorFn: (r) => r._count.supportTickets,
        cell: ({ row }) => row.original._count.supportTickets,
      },
      {
        id: 'createdAt',
        header: 'Created',
        accessorFn: (r) => new Date(r.createdAt).getTime(),
        cell: ({ row }) => (
          <span className="text-white/60">{new Date(row.original.createdAt).toLocaleDateString()}</span>
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
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Customers</h1>
          <p className="text-sm text-white/60">Search and inspect every customer’s app data</p>
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
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button variant="secondary" size="icon" aria-label="Toggle columns">
                <Columns className="h-4 w-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content
                className="min-w-[180px] rounded-xl border border-white/[0.07] bg-[var(--panel)] p-2 shadow-xl"
                sideOffset={8}
              >
                {table.getAllLeafColumns().map((col) => (
                  <Dropdown.CheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(v) => col.toggleVisibility(!!v)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-white outline-none hover:bg-white/10 data-[highlighted]:bg-white/10"
                  >
                    {col.columnDef.header as string}
                  </Dropdown.CheckboxItem>
                ))}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
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
            Customer directory
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} total` : '—'} · Showing {rows.length} results
            {sorting.length > 0 && ` · Sorted by ${sorting[0].id}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-white/[0.07] bg-white/[0.03] text-left text-xs font-semibold uppercase tracking-wide text-white/50">
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="px-5 py-3"
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
                    {Array.from({ length: 8 }).map((_, i) => (
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
                            ? 'Try a different search or clear the filter.'
                            : 'Customers from your app will appear here.'
                        }
                        action={
                          debouncedSearch ? (
                            <Button variant="secondary" onClick={() => setSearch('')}>
                              Clear search
                            </Button>
                          ) : null
                        }
                        className="rounded-none border-0 bg-transparent py-12"
                      />
                    </td>
                  </tr>
                )}
                {!loading &&
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-white/[0.07] hover:bg-white/[0.04]">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-5 py-4">
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
              <div className="text-sm text-white/60">
                Page <span className="text-white">{page}</span> of{' '}
                <span className="text-white">{data.pagination.totalPages}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
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
