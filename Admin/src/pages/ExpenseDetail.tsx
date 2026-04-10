import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Receipt, 
  Calendar, 
  Tag, 
  User, 
  CarFront, 
  ExternalLink, 
  Clock,
  ShieldCheck,
  AlertCircle,
  FileText,
  Smartphone,
  Maximize2
} from 'lucide-react';
import { adminApi, type AdminExpenseDetail } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/dateUtils';

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expense, setExpense] = useState<AdminExpenseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      setLoading(true);
      adminApi.getExpense(id)
        .then(res => {
          if (res.success) {
            setExpense(res.data);
          } else {
            setError('Failed to load expense details');
          }
        })
        .catch(() => setError('An error occurred while fetching data'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-[0.2em] text-white/30">Loading Transaction...</p>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-red-500/50" />
        <p className="text-sm font-bold text-white/50">{error || 'Expense not found'}</p>
        <Button onClick={() => navigate('/expenses')} variant="secondary" className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header / Breadcrumb (Static) */}
      <div className="flex-none flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-1 pb-6 pt-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/expenses?customerId=${expense.customerId}`)}
            className="group flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-white/40 transition hover:bg-white/10 hover:text-white border border-white/5"
          >
            <ArrowLeft className="h-5 w-5 transition group-hover:-translate-x-0.5" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white leading-tight">Expense Detail</h1>
            <p className="text-[10px] uppercase font-bold text-white/55 tracking-[0.3em]">REF: {expense.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest border shadow-xl bg-black/40",
            expense.verificationStatus === 'VERIFIED' 
              ? "border-emerald-500/20 text-white/90"
              : "border-amber-500/20 text-white/90"
          )}>
            {expense.verificationStatus === 'VERIFIED' 
              ? <ShieldCheck className="h-3 w-3 text-emerald-400" /> 
              : <Clock className="h-3 w-3 text-amber-400" />}
            {expense.verificationStatus}
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-20 custom-scrollbar pr-2">
        {/* Entity Identity (Customer & Vehicle Context) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Customer Context Card */}
           <Card className="group relative overflow-hidden border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
              <CardContent className="p-6 flex items-center justify-between">
                 <div className="flex items-center gap-5">
                    <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black/40 flex items-center justify-center shrink-0">
                       {expense.customer?.profilePic ? (
                         <img src={expense.customer.profilePic} alt={expense.customer.fullName} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                       ) : (
                         <User className="h-7 w-7 text-white/20" />
                       )}
                    </div>
                    <div className="min-w-0">
                       <div className="text-[10px] font-black text-[var(--accent)] uppercase tracking-[0.2em] mb-1">Customer Profile</div>
                       <h4 className="truncate text-base font-black text-white">{expense.customer?.fullName}</h4>
                       <div className="mt-1 flex items-center gap-3 text-[11px] font-bold text-white/50">
                          <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> {expense.customer?.phoneNumber}</span>
                       </div>
                    </div>
                 </div>
                 <Link 
                   to={`/customers/${expense.customerId}`}
                   state={{ sourceContext: 'expenses' }}
                   className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-white/40 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition-all border border-white/5"
                 >
                   <ExternalLink className="h-5 w-5" />
                 </Link>
              </CardContent>
           </Card>

           {/* Vehicle Context Card */}
           <Card className="group relative overflow-hidden border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
              <CardContent className="p-6 flex items-center gap-5">
                 <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-black/40 flex items-center justify-center shrink-0">
                    {expense.vehicle?.imageUrl ? (
                      <img src={expense.vehicle.imageUrl} alt={expense.vehicle.registrationNumber} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                    ) : (
                      <CarFront className="h-7 w-7 text-white/20" />
                    )}
                 </div>
                 <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-1">Vehicle Asset</div>
                    <h4 className="truncate text-base font-black text-white">{expense.vehicle?.registrationNumber || 'N/A'}</h4>
                    <div className="mt-1 flex items-center gap-2 text-[11px] font-bold text-white/50">
                       <CarFront className="h-3.5 w-3.5" />
                       <span>{expense.vehicle?.make} {expense.vehicle?.model}</span>
                    </div>
                 </div>
                 <div className="h-10 w-10 flex items-center justify-center text-white/10">
                    <CarFront className="h-6 w-6" />
                 </div>
              </CardContent>
           </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Financial Data */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="overflow-hidden border-white/[0.05] bg-gradient-to-br from-white/[0.03] to-transparent relative">
               <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-50" />
               <CardContent className="p-8 pt-10">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                     <div className="text-center md:text-left">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-[0.2em] mb-2 block">Total Amount</span>
                        <div className="text-5xl font-black text-white tracking-tighter">
                          <span className="text-2xl text-white/50 mr-1 font-black">₹</span>
                          {expense.amount.toLocaleString('en-IN')}
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-5 py-3 rounded-2xl self-center md:self-end">
                        <Tag className="h-4 w-4 text-[var(--accent)]" />
                        <span className="text-xs font-black uppercase tracking-widest text-white/90">{expense.category}</span>
                     </div>
                  </div>

                  <div className="mt-10 grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
                     <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                           <Calendar className="h-3.5 w-3.5" />
                           Date
                        </div>
                        <div className="text-base font-black text-white/90">{formatDate(expense.date)}</div>
                     </div>
                     <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                           <Clock className="h-3.5 w-3.5" />
                           Time
                        </div>
                        <div className="text-base font-black text-white/90">{new Date(expense.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* Description Card */}
            <Card className="border-white/[0.05] bg-white/[0.01]">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-white/70 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Additional Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {expense.description ? (
                  <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 text-sm text-white/80 leading-relaxed italic">
                    "{expense.description}"
                  </div>
                ) : (
                  <div className="text-center py-10">
                     <p className="text-xs font-bold text-white/40 uppercase tracking-widest italic">No additional description provided by user</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Receipt View & Verification */}
          <div className="space-y-6">
            <Card className="border-white/[0.05] bg-white/[0.01]">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-white/70 flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Receipt Proof
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {expense.receiptUrl ? (
                  <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 ring-1 ring-white/5">
                    <img 
                      src={expense.receiptUrl} 
                      alt="Receipt" 
                      className="w-full h-auto transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6">
                       <a 
                         href={expense.receiptUrl} 
                         target="_blank" 
                         rel="noreferrer"
                         className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-black font-black text-[10px] uppercase tracking-widest shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                       >
                         <Maximize2 className="h-3.5 w-3.5" />
                         Expand Receipt
                       </a>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                      <Receipt className="h-8 w-8 text-white/40" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50">No receipt uploaded</p>
                  </div>
                )}
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[9px] font-bold text-white/60 uppercase tracking-widest">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-black text-white/90 truncate">{value}</div>
    </div>
  );
}
