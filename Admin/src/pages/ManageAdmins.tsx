import { useEffect, useMemo, useState } from 'react';
import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  flexRender,
} from '@tanstack/react-table';
import { Search, Shield, ChevronUp, ChevronDown, UserCircle, Loader2, CheckSquare, Square, Trash2, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';


import { adminApi, type AdminUserListItem } from '../api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/dateUtils';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import LoadingScreen from '../components/LoadingScreen/LoadingScreen';
import { AdminManagementModal } from '../components/ui/AdminManagementModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/Select";

const PAGE_SIZE = 20;

export default function ManageAdmins() {
  const [data, setData] = useState<{
    data: AdminUserListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const { admin } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedAdminForManage, setSelectedAdminForManage] = useState<AdminUserListItem | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('');


  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';

  const debouncedSearch = useDebouncedValue(search, 250);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    adminApi.listAdmins({ 
        page, 
        limit: PAGE_SIZE, 
        search: debouncedSearch || undefined, 
        role: roleFilter || undefined 
    }).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.success) setData(res.data);
      else setError(res.error.message);
    });
    return () => {
      ignore = true;
    };
  }, [page, debouncedSearch, roleFilter, refreshKey]);

  const rows = useMemo(() => data?.data ?? [], [data]);

  const columns = useMemo<ColumnDef<AdminUserListItem>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <div className="flex items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Filter out current admin from multi-select
                const selectableRows = rows.filter(r => r.id !== admin?.id);
                const selectableIds = selectableRows.map((r) => r.id);
                
                if (selectedIds.size === selectableIds.length && selectableIds.length > 0) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(selectableIds));
                }
              }}
              className="p-1 hover:bg-white/5 rounded transition-colors"
            >
              {selectedIds.size === rows.length - 1 && rows.length > 1 ? (
                <CheckSquare className="h-4 w-4 text-[var(--accent)]" />
              ) : (
                <Square className="h-4 w-4 text-white/20" />
              )}
            </button>
          </div>
        ),
        cell: ({ row }: any) => {
          const isMe = row.original.id === admin?.id;
          if (isMe) return null; // Cannot select self

          return (
            <div className="flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newSelected = new Set(selectedIds);
                  if (newSelected.has(row.original.id)) {
                    newSelected.delete(row.original.id);
                  } else {
                    newSelected.add(row.original.id);
                  }
                  setSelectedIds(newSelected);
                }}
                className="p-1 hover:bg-white/5 rounded transition-colors"
              >
                {selectedIds.has(row.original.id) ? (
                  <CheckSquare className="h-4 w-4 text-[var(--accent)]" />
                ) : (
                  <Square className="h-4 w-4 text-white/20" />
                )}
              </button>
            </div>
          );
        },
      },
      {
        id: 'admin',
        header: 'Administrator',
        accessorFn: (r) => r.name || r.email,
        cell: ({ row }) => {
          const c = row.original;
          const isMe = c.id === admin?.id;
          return (
            <div className="flex items-center gap-3 group">
              <div className="h-9 w-9 overflow-hidden rounded-full bg-white/[0.03] ring-1 ring-white/10 group-hover:ring-[var(--accent)]/50 transition-all">
                <div className="flex h-full w-full items-center justify-center text-white/20">
                  <UserCircle className="h-5 w-5" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-white group-hover:text-[var(--accent)] transition-colors">
                    {c.name || 'Unnamed Admin'}
                  </div>
                  {isMe && (
                    <span className="text-[10px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest">
                      You
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/60 tracking-tight">
                  <Mail className="h-3 w-3 opacity-50" />
                  {c.email}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'role',
        header: 'Role',
        accessorFn: (r) => r.role,
        cell: ({ row }) => {
          const role = row.original.role;
          const isSuper = role === 'SUPER_ADMIN';
          return (
            <span className={cn(
              "inline-flex h-[24px] items-center rounded-lg px-2.5 text-[10px] font-black tracking-widest uppercase border",
              isSuper 
                ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/10" 
                : "bg-white/5 text-white/40 border-white/5"
            )}>
              {role.replace('_', ' ')}
            </span>
          );
        }
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (r) => r.isActive,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-1.5 w-1.5 rounded-full",
                c.isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-white/20"
              )} />
              <span className={cn(
                "text-[10px] uppercase font-black tracking-widest leading-none",
                c.isActive ? "text-emerald-500" : "text-white/30"
              )}>
                {c.isActive ? 'Active' : 'Pending'}
              </span>
            </div>
          );
        }
      },
      {
        id: 'customerAccess',
        header: 'Customer Access',
        cell: ({ row }) => {
          const c = row.original;
          if (c.role !== 'SUPPORT') return (
            <span className="text-[10px] text-white/10 uppercase font-black tracking-widest">Full Access</span>
          );

          return (
            <div className="flex items-center gap-2">
               <span className={cn(
                 "text-[10px] font-black uppercase tracking-widest",
                 c.canAccessCustomers ? "text-emerald-500/60" : "text-red-500/60"
               )}>
                 {c.canAccessCustomers ? 'Activated' : 'Locked'}
               </span>
            </div>
          );
        }
      },
      {
        id: 'joined',

        header: 'Created On',
        accessorFn: (r) => new Date(r.createdAt).getTime(),
        cell: ({ row }) => (
          <span className="text-[11px] text-white/60">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [selectedIds, rows, admin]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const handleToggleAccess = async (id: string) => {
    try {
      const res = await adminApi.toggleSupportCustomerAccess(id);
      if (res.success) {
        setRefreshKey(prev => prev + 1);
        // Update local state if this is the selected admin
        if (selectedAdminForManage?.id === id) {
          setSelectedAdminForManage(prev => prev ? { ...prev, canAccessCustomers: !prev.canAccessCustomers } : null);
        }
      } else {
        setError(res.error.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update access');
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const res = await adminApi.toggleAdminStatus(id);
      if (res.success) {
        setRefreshKey(prev => prev + 1);
        // Update local state if this is the selected admin
        if (selectedAdminForManage?.id === id) {
          setSelectedAdminForManage(prev => prev ? { ...prev, isActive: !prev.isActive } : null);
        }
      } else {
        setError(res.error.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    }
  };



  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await adminApi.deleteAdmins(Array.from(selectedIds));
      if (res.success) {
        setPage(1);
        setSelectedIds(new Set());
        setShowDeleteConfirm(false);
        setRefreshKey(prev => prev + 1);
      } else {
        setError(res.error.message);
      }
    } catch (err) {
      console.error('Delete failed:', err);
      setError('An unexpected error occurred during deletion.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <EmptyState 
          icon={<Shield className="h-10 w-10 text-red-500" />}
          title="Access Denied"
          description="You do not have permission to access this page. Only Super Admins can manage administrative users."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Admin Management</h1>
          <p className="text-sm text-white/60">View and manage administrative access for the dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="h-11 px-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedIds.size})
                </>
              )}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Select value={roleFilter} onValueChange={(val) => {
              setRoleFilter(val === 'ALL' ? '' : val);
              setPage(1);
            }}>
              <SelectTrigger className="h-11 min-w-[160px] rounded-2xl bg-white/[0.05] border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/[0.08] focus:ring-0 text-white transition-all">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent className="bg-[#0c0c0e]/95 backdrop-blur-xl border-white/10 text-white min-w-[160px] rounded-2xl">
                <SelectItem value="ALL" className="text-[10px] font-black uppercase tracking-widest focus:bg-white/10 focus:text-white cursor-pointer py-3">All Roles</SelectItem>
                <SelectItem value="SUPER_ADMIN" className="text-[10px] font-black uppercase tracking-widest focus:bg-white/10 focus:text-white cursor-pointer py-3">Super Admin</SelectItem>
                <SelectItem value="ADMIN" className="text-[10px] font-black uppercase tracking-widest focus:bg-white/10 focus:text-white cursor-pointer py-3">Admin</SelectItem>
                <SelectItem value="SUPPORT" className="text-[10px] font-black uppercase tracking-widest focus:bg-white/10 focus:text-white cursor-pointer py-3">Support</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative w-full max-w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                type="search"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-11 w-full rounded-2xl bg-white/[0.05] border border-white/10 pl-10 pr-4 text-sm text-white placeholder:text-white/30 hover:bg-white/[0.08] focus:bg-white/[0.08] focus:border-[var(--accent)]/50 focus:outline-none transition-all"
              />
            </div>
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
            <Shield className="h-4 w-4 text-[var(--accent)]" />
            System Administrators
          </CardTitle>
          <CardDescription>
            {data ? `${data.pagination.total} total admins` : '—'} · Showing {rows.length} results
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[#0c0c0e]">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-white/[0.07] text-xs font-semibold uppercase tracking-wide text-white/75 bg-[#111]">
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
                        icon={<Shield className="h-6 w-6" />}
                        title="No admins found"
                        description={
                          debouncedSearch
                            ? 'Adjust your search terms to find what you are looking for.'
                            : 'Other administrators will appear here once they sign up.'
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
                      className="border-b border-white/[0.07] transition-colors hover:bg-white/[0.04] cursor-pointer group/row"
                      onClick={() => setSelectedAdminForManage(row.original)}
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
            <div className="flex items-center justify-between border-t border-white/[0.04] bg-black/20 p-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Found {data.pagination.total} Administrators
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
                            page === p ? "bg-[var(--accent)] text-black shadow-lg" : "text-white/40 hover:bg-white/5"
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

      {isDeleting && <LoadingScreen />}

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Administrators"
        description={`Are you sure you want to delete ${selectedIds.size} selected administrator(s)? They will lose access to the system immediately. This action cannot be undone.`}
        confirmLabel={isDeleting ? 'Deleting...' : 'Delete Selected'}
        confirmIcon={Trash2}
        confirmVariant="danger"
        isProcessing={isDeleting}
      />

      <AdminManagementModal
        isOpen={!!selectedAdminForManage}
        onClose={() => setSelectedAdminForManage(null)}
        admin={selectedAdminForManage}
        onToggleStatus={handleToggleStatus}
        onToggleAccess={handleToggleAccess}
        isSelf={selectedAdminForManage?.id === admin?.id}
      />
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
