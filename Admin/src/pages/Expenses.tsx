import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
  flexRender,
} from '@tanstack/react-table';
import { 
  Search,
  Receipt, 
  ShieldCheck, 
  Clock, 
  CarFront, 
  User, 
  ArrowRight
} from 'lucide-react';
import { adminApi, type AdminExpenseListItem } from '../api/client';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/dateUtils';

const PAGE_SIZE = 20;

export default function Expenses() {
  const navigate = useNavigate();
  const [data, setData] = useState<{
    data: AdminExpenseListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    adminApi.listExpenses({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success) setData(res.data);
      else setError(res.error.message);
    });
    return () => {
      ignore = false;
    };
  }, [page, debouncedSearch]);

  const rows = useMemo(() => data?.data ?? [], [data]);

  const columns = useMemo<ColumnDef<AdminExpenseListItem>[]>(
    () => [
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white/90">{formatDate(row.original.date)}</span>
            <span className="text-[10px] text-white/30">{new Date(row.original.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ),
      },
      {
        accessorKey: 'customer',
        header: 'Customer',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                <User className="h-4 w-4 text-[var(--accent)]" />
             </div>
             <div className="flex flex-col">
                <span className="text-xs font-black text-white">{row.original.customer?.fullName || 'Unknown'}</span>
                <span className="text-[10px] text-white/40">{row.original.customer?.phoneNumber}</span>
             </div>
          </div>
        ),
      },
      {
        accessorKey: 'vehicle',
        header: 'Vehicle',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
             <CarFront className="h-3.5 w-3.5 text-white/20" />
             <span className="text-xs font-bold text-white/70">{row.original.vehicle?.registrationNumber || 'N/A'}</span>
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => (
          <span className="inline-flex rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/40 border border-white/5">
            {row.original.category}
          </span>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="text-sm font-black text-white">
            ₹{row.original.amount.toLocaleString('en-IN')}
          </span>
        ),
      },
      {
        accessorKey: 'verificationStatus',
        header: 'Status',
        cell: ({ row }) => (
          <div className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
            row.original.verificationStatus === 'VERIFIED' 
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-amber-500/10 text-amber-400"
          )}>
            {row.original.verificationStatus === 'VERIFIED' ? <ShieldCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {row.original.verificationStatus}
          </div>
        ),
      },
      {
        id: 'actions',
        cell: () => (
          <div className="flex justify-end pr-4 text-white/20 transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]">
            <ArrowRight className="h-4 w-4" />
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2 pb-20 pt-2">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
            <Receipt className="h-6 w-6 text-[var(--accent)]" />
            Expense Transactions
          </h1>
          <p className="text-xs font-bold text-[#71717a] uppercase tracking-widest mt-1">Audit and verify customer expenses</p>
        </div>

        <div className="flex items-center gap-3">
           <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717a] transition-colors group-focus-within:text-[var(--accent)]" />
              <input
                type="text"
                placeholder="Search Category or Customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-64 rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm font-medium text-white transition-all focus:border-[var(--accent)]/50 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-[var(--accent)]/10"
              />
           </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-bold text-red-400">
          {error}
        </div>
      )}

      <Card className="border-none bg-[#0a0a0a] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-white/[0.04] bg-white/[0.02]">
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={columns.length} />)
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <Receipt className="h-12 w-12" />
                        <p className="text-sm font-bold uppercase tracking-widest">No expenses found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/expenses/${row.original.id}`)}
                      className="group cursor-pointer transition-all hover:bg-white/[0.03] active:bg-white/[0.05]"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-6 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/[0.04] bg-black/20 p-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Found {data.pagination.total} Transactions
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8 rounded-lg text-[10px] font-black uppercase"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1 mx-2">
                   {Array.from({ length: Math.min(5, data.pagination.totalPages) }).map((_, i) => {
                     const p = i + 1;
                     return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={cn(
                            "h-7 w-7 rounded-lg text-[10px] font-black transition-all",
                            page === p ? "bg-[var(--accent)] text-white shadow-lg" : "text-white/40 hover:bg-white/5"
                          )}
                        >
                          {p}
                        </button>
                     );
                   })}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page === data.pagination.totalPages}
                  className="h-8 rounded-lg text-[10px] font-black uppercase"
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

// Simple internal debounce hook
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}
