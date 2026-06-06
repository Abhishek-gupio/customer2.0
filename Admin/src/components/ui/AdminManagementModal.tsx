import React, { useState } from 'react';
import { X, UserCircle, Mail, Power, ShieldAlert, Loader2, Calendar } from 'lucide-react';
import Particles from '../Particles/Particles';
import { Button } from './Button';
import { cn } from '../../lib/cn';
import { formatDate } from '../../lib/dateUtils';
import type { AdminUserListItem } from '../../api/client';

interface AdminManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  admin: AdminUserListItem | null;
  onToggleStatus: (id: string) => Promise<void>;
  onToggleAccess: (id: string) => Promise<void>;
  isSelf: boolean;
}

export const AdminManagementModal: React.FC<AdminManagementModalProps> = ({
  isOpen,
  onClose,
  admin,
  onToggleStatus,
  onToggleAccess,
  isSelf
}) => {
  const [isProcessingStatus, setIsProcessingStatus] = useState(false);
  const [isProcessingAccess, setIsProcessingAccess] = useState(false);

  if (!isOpen || !admin) return null;

  const handleStatusToggle = async () => {
    try {
      setIsProcessingStatus(true);
      await onToggleStatus(admin.id);
    } finally {
      setIsProcessingStatus(false);
    }
  };

  const handleAccessToggle = async () => {
    try {
      setIsProcessingAccess(true);
      await onToggleAccess(admin.id);
    } finally {
      setIsProcessingAccess(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-hidden">
      {/* Background Overlay with Particles */}
      <div 
        className="absolute inset-0 bg-black/90 animate-in fade-in duration-500"
        onClick={onClose}
      />
      
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <Particles
          particleColors={["#ffffff", "var(--accent)"]}
          particleCount={100}
          particleSpread={10}
          speed={0.1}
          particleBaseSize={80}
          moveParticlesOnHover={false}
          alphaParticles={true}
          disableRotation={false}
        />
      </div>

      {/* Modal Card */}
      <div className="relative w-full max-w-[400px] max-h-[calc(100vh-48px)] overflow-y-auto bg-[#0c0c0c] border border-white/10 rounded-[32px] p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ease-out flex flex-col custom-scrollbar">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95 z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Profile Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 blur-3xl rounded-full bg-[var(--accent)]/20 animate-pulse" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/10 bg-gradient-to-br from-white/10 to-transparent shadow-2xl">
              <UserCircle className="h-10 w-10 text-[var(--accent)]" />
              {isSelf && (
                <div className="absolute -top-2 -right-2 bg-[var(--accent)] text-black text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest shadow-lg">
                  You
                </div>
              )}
            </div>
          </div>

          <h3 className="text-2xl font-black tracking-tight text-white mb-1.5 text-center px-4">
            {admin.name || 'Unnamed Admin'}
          </h3>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-zinc-400 font-medium text-xs">
              <Mail className="h-3 w-3 text-white/20" />
              {admin.email}
            </div>
            <div className="flex items-center gap-2 text-zinc-500 font-medium text-[10px] uppercase tracking-widest">
              <Calendar className="h-2.5 w-2.5 opacity-40" />
              Joined {formatDate(admin.createdAt)}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 mb-6">
           <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-0.5">
             <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Role</span>
             <span className="text-xs font-bold text-white uppercase">{admin.role.replace('_', ' ')}</span>
           </div>
           <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-0.5">
             <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Status</span>
             <div className="flex items-center gap-1.5">
               <div className={cn("h-1.5 w-1.5 rounded-full", admin.isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-white/20")} />
               <span className={cn("text-[10px] font-black uppercase tracking-wider", admin.isActive ? "text-emerald-500" : "text-white/40")}>
                 {admin.isActive ? 'Active' : 'Pending'}
               </span>
             </div>
           </div>
        </div>

        {/* Actions Section */}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 p-4 rounded-[20px] bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3 mb-1">
               <div className="p-1.5 bg-white/5 rounded-lg">
                 <Power className="h-3.5 w-3.5 text-white/60" />
               </div>
               <div className="flex flex-col">
                 <span className="text-[11px] font-bold text-white">Account Status</span>
                 <span className="text-[9px] text-white/30">Toggle portal access</span>
               </div>
            </div>
            
            <Button
              variant="secondary"
              className={cn(
                "h-10 w-full rounded-xl transition-all font-black text-[11px] uppercase tracking-wider",
                admin.isActive 
                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/10" 
                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/10"
              )}
              onClick={handleStatusToggle}
              disabled={isProcessingStatus || isSelf}
            >
              {isProcessingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : admin.isActive ? (
                'Disable Account'
              ) : (
                'Approve & Activate'
              )}
            </Button>
            {isSelf && <p className="text-[8px] text-center text-white/20">You cannot disable your own primary account.</p>}
          </div>

          {admin.role === 'SUPPORT' && (
            <div className="flex flex-col gap-2 p-4 rounded-[20px] bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3 mb-1">
                 <div className="p-1.5 bg-white/5 rounded-lg">
                   <ShieldAlert className="h-3.5 w-3.5 text-white/60" />
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[11px] font-bold text-white">Customer Access</span>
                   <span className="text-[9px] text-white/30">Control database visibility</span>
                 </div>
              </div>
              
              <Button
                variant="secondary"
                className={cn(
                  "h-10 w-full rounded-xl transition-all font-black text-[11px] uppercase tracking-wider",
                  admin.canAccessCustomers 
                    ? "bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/10" 
                    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border-emerald-500/10"
                )}
                onClick={handleAccessToggle}
                disabled={isProcessingAccess}
              >
                {isProcessingAccess ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : admin.canAccessCustomers ? (
                  'Deactivate Customer Access'
                ) : (
                  'Activate Customer Access'
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-5 border-t border-white/5 flex justify-center">
            <button 
              onClick={onClose}
              className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 hover:text-white transition-colors"
            >
              Close Panel
            </button>
        </div>
      </div>
    </div>
  );
};
