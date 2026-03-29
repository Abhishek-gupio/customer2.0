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
import { Search, Users, ChevronUp, ChevronDown, UserCircle, FileDown, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { adminApi, type CustomerListItem } from '../api/client';
import logoImg from '../assets/images/logo.png';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/dateUtils';

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
        id: 'joined',
        header: 'Joined',
        accessorFn: (r) => new Date(r.createdAt).getTime(),
        cell: ({ row }) => (
          <span className="text-[11px] text-white/40">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const { hasRole, admin } = useAuth();
          const [exporting, setExporting] = useState(false);

          const handleExport = async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (exporting) return;
            setExporting(true);
            try {
              const res = await adminApi.getCustomer(row.original.id);
              if (res.success) {
                const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
                const html = generateCustomerExport(res.data, { 
                  showLogo: isSuperAdmin, 
                  logoUrl: logoImg 
                });

                // Create an isolated iframe for printing
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                document.body.appendChild(iframe);

                const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
                if (frameDoc) {
                  frameDoc.open();
                  frameDoc.write(html);
                  frameDoc.close();

                  // Wait for content to load before opening the print dialog
                  setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    document.body.removeChild(iframe);
                  }, 500);
                }
              }
            } catch (err) {
              console.error('Export failed:', err);
            } finally {
              setExporting(false);
            }
          };

          if (!hasRole('ADMIN', 'SUPER_ADMIN')) return null;

          return (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-2 rounded-lg border-white/5 bg-white/5 hover:bg-white/10 text-[10px] uppercase font-bold tracking-wider"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <FileDown className="h-3 w-3 mr-1.5" />
                  Download
                </>
              )}
            </Button>
          );
        },
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

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--accent)]" />
            Active Users
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} total members` : '—'} · Showing {rows.length} results
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


export const generateCustomerExport = (data: any, options?: { showLogo?: boolean; logoUrl?: string }) => {
  const customer = data;
  const { vehicles = [], expenses = [], supportTickets = [], documents = [], expenseSummary } = data;
  const exportDate = formatDate(new Date());
  const joinDate = formatDate(customer.createdAt);
  const vehicleCount = vehicles.length;
  const totalExpenses = expenseSummary?.total || 0;
  const currency = expenseSummary?.currency || 'INR';

  const breakdown = expenseSummary?.breakdown || {};
  const activeCategories = Object.entries(breakdown)
    .filter(([_, amount]) => (amount as number) > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title></title>
  <base href="${window.location.origin}">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; line-height: 1.5; padding: 40px; background: #fff; max-width: 900px; margin: 0 auto; }
    .header { border-bottom: 2px solid #f0f0f0; padding-bottom: 24px; margin-bottom: 32px; }
    .customer-name { font-size: 32px; font-weight: 800; tracking: -0.02em; color: #000; margin-bottom: 12px; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 10px; font-weight: 800; color: #999; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
    .meta-value { font-size: 15px; font-weight: 600; color: #333; }
    
    .section { margin-bottom: 40px; }
    .section-title { font-size: 14px; font-weight: 800; color: #000; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px; display: flex; align-items: center; }
    .section-title::after { content: ""; flex: 1; height: 1px; background: #eee; margin-left: 16px; }
    
    .summary-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .card { background: #f8f9fa; border: 1px solid #eee; border-radius: 12px; padding: 20px; }
    .card.highlight { background: #000; color: #fff; border: none; }
    .card.highlight .meta-label { color: rgba(255,255,255,0.5); }
    .card.highlight .meta-value { color: #fff; }
    .amount { font-size: 24px; font-weight: 800; }

    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px 16px; border-bottom: 2px solid #eee; font-size: 11px; font-weight: 800; color: #999; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 12px 16px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #444; }
    .badge { padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: #eee; color: #666; }
    .status-active { background: #e6fcf5; color: #0ca678; }
    
    @media print {
      @page { margin: 0; }
      body { padding: 40px; }
      .card { border: 1px solid #eee !important; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${options?.showLogo ? `
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="${options.logoUrl}" alt="Gupio Logo" style="height: 60px; object-fit: contain;">
    </div>
  ` : ''}
  <div class="header">
    <div class="customer-name">${customer.fullName || 'Unnamed Customer'}</div>
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">Export Date</div>
        <div class="meta-value">${exportDate}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Joined On</div>
        <div class="meta-value">${joinDate}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Vehicle Inventory</div>
        <div class="meta-value">${vehicleCount} ${vehicleCount === 1 ? 'Vehicle' : 'Vehicles'}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Expense Overview</div>
    <div class="summary-cards" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
      <div class="card highlight">
        <div class="meta-label">Total Amount</div>
        <div class="amount">${currency} ${totalExpenses.toLocaleString()}</div>
      </div>
      ${activeCategories.map(([cat, amt]) => `
        <div class="card">
          <div class="meta-label">${cat.toUpperCase()} EXPENSES</div>
          <div class="amount" style="color: ${cat === 'fuel' ? '#2f9e44' : cat === 'service' ? '#1971c2' : '#d6336c'};">
            ${currency} ${(amt as number).toLocaleString()}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Expense History (${expenses.length})</div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Category</th>
          <th>Merchant</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${expenses.map((e: any) => `
          <tr>
            <td>${formatDate(e.date)}</td>
            <td><span class="badge">${e.category}</span></td>
            <td>${e.merchantName || '—'}</td>
            <td><strong>${currency} ${e.amount.toLocaleString()}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Vehicles (${vehicles.length})</div>
    <table>
      <thead>
        <tr>
          <th>Model</th>
          <th>Reg. Number</th>
          <th>Fuel</th>
          <th>Health</th>
        </tr>
      </thead>
      <tbody>
        ${vehicles.map((v: any) => `
          <tr>
            <td><strong>${v.make} ${v.model}</strong></td>
            <td><code>${v.registrationNumber}</code></td>
            <td>${v.fuelType || '—'}</td>
            <td><span class="badge ${v.healthScore?.overallScore > 70 ? 'status-active' : ''}">${v.healthScore?.overallScore || 'N/A'}%</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Uploaded Documents (${documents.length})</div>
    <table>
      <thead>
        <tr>
          <th>Type</th>
          <th>Number</th>
          <th>Expiry</th>
        </tr>
      </thead>
      <tbody>
        ${documents.map((d: any) => `
          <tr>
            <td>${d.type}</td>
            <td>${d.documentNumber || '—'}</td>
            <td>${d.expiryDate ? formatDate(d.expiryDate) : '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Support Tickets (${supportTickets.length})</div>
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Category</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${supportTickets.map((t: any) => `
          <tr>
            <td>${t.subject}</td>
            <td>${t.category}</td>
            <td><span class="badge">${t.status}</span></td>
            <td>${formatDate(t.createdAt)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
  `;
};
