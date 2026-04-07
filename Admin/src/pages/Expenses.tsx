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
  CarFront, 
  ArrowRight,
  Users,
  ArrowLeft,
  UserCircle
} from 'lucide-react';
import { adminApi, type AdminExpenseListItem, type CustomerListItem } from '../api/client';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/dateUtils';

const PAGE_SIZE = 20;

type ViewMode = 'CUSTOMERS' | 'TRANSACTIONS';

export default function Expenses() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('CUSTOMERS');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerListItem | null>(null);
  
  const [customerData, setCustomerData] = useState<{
    data: CustomerListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } | null>(null);
  
  const [expenseData, setExpenseData] = useState<{
    data: AdminExpenseListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebouncedValue(search, 300);

  // Fetch Customers level 1
  useEffect(() => {
    if (viewMode !== 'CUSTOMERS') return;
    
    let ignore = false;
    setLoading(true);
    adminApi.listCustomers({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success) setCustomerData(res.data);
      else setError(res.error.message);
    });
    return () => {
      ignore = true;
    };
  }, [page, debouncedSearch, viewMode]);

  // Fetch Expenses level 2
  useEffect(() => {
    if (viewMode !== 'TRANSACTIONS' || !selectedCustomer) return;
    
    let ignore = false;
    setLoading(true);
    adminApi.listExpenses({ 
      page, 
      limit: PAGE_SIZE, 
      search: debouncedSearch || undefined,
      customerId: selectedCustomer.id 
    }).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success) setExpenseData(res.data);
      else setError(res.error.message);
    });
    return () => {
      ignore = true;
    };
  }, [page, debouncedSearch, viewMode, selectedCustomer]);

  const customerColumns = useMemo<ColumnDef<CustomerListItem>[]>(
    () => [
      {
        id: 'customer',
        header: 'Customer Name',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-4 py-1">
              <div className="h-10 w-10 overflow-hidden rounded-xl bg-white/[0.03] ring-1 ring-white/10 group-hover:ring-[var(--accent)]/50 transition-all flex items-center justify-center shrink-0 shadow-lg">
                {c.profilePic ? (
                  <img src={c.profilePic} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserCircle className="h-6 w-6 text-white/20" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-black text-white group-hover:text-[var(--accent)] transition-colors truncate">{c.fullName || 'Unnamed User'}</div>
                <div className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-0.5">{c.phoneNumber}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'stats',
        header: 'Expense Summary',
        cell: ({ row }) => {
          const count = row.original._count?.expenses || 0;
          return (
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-[var(--accent)]/40 group-hover:bg-[var(--accent)] transition-colors shadow-[0_0_8px_rgba(var(--accent-rgb),0.3)]" />
              <span className="text-xs font-black text-white/80">{count} Records</span>
            </div>
          );
        }
      },
      {
        id: 'joined',
        header: 'Registered On',
        cell: ({ row }) => (
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        cell: () => (
          <div className="flex justify-end pr-4">
             <div className="flex h-8 px-3 items-center gap-2 rounded-lg bg-white/5 text-[9px] font-black uppercase tracking-widest text-white/40 group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)] transition-all border border-white/5">
                View Expenses
                <ArrowRight className="h-3 w-3" />
             </div>
          </div>
        ),
      },
    ],
    []
  );

  const expenseColumns = useMemo<ColumnDef<AdminExpenseListItem>[]>(
    () => [
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-xs font-black text-white/90 uppercase">{formatDate(row.original.date)}</span>
            <span className="text-[10px] font-bold text-white/40 tracking-wider">{new Date(row.original.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ),
      },
      {
        accessorKey: 'vehicle',
        header: 'Vehicle',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
             <CarFront className="h-3.5 w-3.5 text-white/40" />
             <span className="text-xs font-bold text-white/70">{row.original.vehicle?.registrationNumber || 'N/A'}</span>
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => (
          <span className="inline-flex rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white/70 border border-white/10">
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
        id: 'actions',
        cell: () => (
          <div className="flex justify-end pr-4 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]">
            <ArrowRight className="h-4 w-4" />
          </div>
        ),
      },
    ],
    []
  );

  const displayData = viewMode === 'CUSTOMERS' ? customerData : expenseData;
  const currentRows = displayData?.data ?? [];
  const currentColumns = viewMode === 'CUSTOMERS' ? customerColumns : expenseColumns;

  const table = useReactTable({
    data: currentRows as any,
    columns: currentColumns as any,
    getCoreRowModel: getCoreRowModel(),
  });

  const handlePageChange = (p: number) => {
     setPage(p);
  };

  const resetView = () => {
     setViewMode('CUSTOMERS');
     setSelectedCustomer(null);
     setPage(1);
     setSearch('');
  };

  const selectCustomer = (customer: CustomerListItem) => {
     setSelectedCustomer(customer);
     setViewMode('TRANSACTIONS');
     setPage(1);
     setSearch('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 pb-8 h-full">
      {/* Header Section (Static) */}
      <div className="flex-none flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-1">
        <div className="flex items-center gap-4">
           {viewMode === 'TRANSACTIONS' && (
              <button 
                onClick={resetView}
                className="group flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all shadow-lg"
              >
                 <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>
           )}
           <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                {viewMode === 'CUSTOMERS' ? (
                  <>
                    <Users className="h-6 w-6 text-[var(--accent)]" />
                    Customer Expenses
                  </>
                ) : (
                  <>
                    <Receipt className="h-6 w-6 text-[var(--accent)]" />
                    {selectedCustomer?.fullName}'s Transactions
                  </>
                )}
              </h1>
              <p className="text-[10px] font-black text-[#71717a] uppercase tracking-[0.2em] mt-1">
                 {viewMode === 'CUSTOMERS' 
                   ? 'Select a customer to audit their expenditures'
                   : `Audit logs for ${selectedCustomer?.phoneNumber}`}
              </p>
           </div>
        </div>

        <div className="flex items-center gap-3">
           <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717a] transition-colors group-focus-within:text-[var(--accent)]" />
              <input
                type="text"
                placeholder={viewMode === 'CUSTOMERS' ? "Search Customers..." : "Search Category or Ref..."}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-11 w-64 rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm font-medium text-white transition-all focus:border-[var(--accent)]/50 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-[var(--accent)]/10 shadow-2xl"
              />
           </div>
        </div>
      </div>

      {error && (
        <div className="flex-none rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-[11px] font-black tracking-widest uppercase text-red-500/80 shadow-2xl">
          {error}
        </div>
      )}

      {/* Table Container (Scrollable) */}
      <Card className="flex-1 flex flex-col min-h-0 border-none bg-[#0a0a0a] shadow-[0_30px_60px_rgba(0,0,0,0.5)] relative overflow-hidden ring-1 ring-white/5">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />
        <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur-md">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-white/[0.04]">
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  Array.from({ length: 12 }).map((_, i) => <TableRowSkeleton key={i} cols={currentColumns.length} />)
                ) : currentRows.length === 0 ? (
                  <tr>
                    <td colSpan={currentColumns.length} className="px-6 py-24 text-center">
                      <div className="flex flex-col items-center gap-5 opacity-20 group">
                        {viewMode === 'CUSTOMERS' ? <Users className="h-16 w-16 group-hover:scale-110 transition-transform" /> : <Receipt className="h-16 w-16 group-hover:scale-110 transition-transform" />}
                        <p className="text-xs font-black uppercase tracking-[0.3em]">{viewMode === 'CUSTOMERS' ? 'No customers found' : 'No transactions found for this user'}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => {
                         const original = row.original as any;
                         if (viewMode === 'CUSTOMERS') selectCustomer(original as CustomerListItem);
                         else navigate(`/expenses/${original.id}`);
                      }}
                      className="group cursor-pointer transition-all hover:bg-white/[0.03] active:bg-white/[0.05]"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-6 py-5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination (Static at bottom) */}
          {displayData && displayData.pagination.totalPages > 1 && (
            <div className="flex-none flex items-center justify-between border-t border-white/[0.04] bg-black/40 p-6 backdrop-blur-xl">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                Found {displayData.pagination.total} {viewMode === 'CUSTOMERS' ? 'Customers' : 'Transactions'}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="h-9 rounded-xl border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1.5 mx-2">
                   {Array.from({ length: Math.min(5, displayData.pagination.totalPages) }).map((_, i) => {
                     const p = i + 1;
                     return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={cn(
                            "h-8 w-8 rounded-xl text-[10px] font-black transition-all border",
                            page === p 
                              ? "bg-[var(--accent)] text-black border-[var(--accent)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]" 
                              : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
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
                  onClick={() => handlePageChange(Math.min(displayData.pagination.totalPages, page + 1))}
                  disabled={page === displayData.pagination.totalPages}
                  className="h-9 rounded-xl border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-widest"
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
