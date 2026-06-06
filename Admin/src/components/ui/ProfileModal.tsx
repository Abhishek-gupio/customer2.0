import React from 'react';
import { X, UserCircle, Mail, ShieldCheck } from 'lucide-react';
import Particles from '../Particles/Particles';



interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  admin: {
    name?: string | null;
    email: string;
    role: string;
  } | null;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  admin
}) => {
  if (!isOpen || !admin) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-hidden">
      {/* Background Overlay with Particles */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      >
        <div className="absolute inset-0 opacity-40">
          <Particles
            particleColors={["#ffffff", "#00f2ff"]}
            particleCount={100}
            particleSpread={10}
            speed={0.1}
            particleBaseSize={80}
            moveParticlesOnHover={false}
            alphaParticles={true}
            disableRotation={false}
          />
        </div>
      </div>

      {/* Modal Card */}
      <div className="relative w-full max-w-[360px] bg-[#0c0c0c]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 ease-out flex flex-col items-center">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Profile Avatar Header */}
        <div className="relative mb-6">
          <div className="absolute inset-0 blur-3xl rounded-full bg-[#00f2ff]/20 animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent shadow-2xl">
            <UserCircle className="h-10 w-10 text-[#00f2ff]" />
          </div>
        </div>

        {/* User Identity */}
        <div className="text-center w-full mb-8">
          <h3 className="text-[24px] font-black tracking-tight text-white mb-1">
            {admin.name || 'Admin User'}
          </h3>
          <div className="flex items-center justify-center gap-2 text-zinc-400 font-medium text-sm">
            <Mail className="h-3.5 w-3.5 text-white/20" />
            {admin.email}
          </div>
        </div>

        {/* Details List */}
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/10">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Access Role</span>
            </div>
            <span className="inline-flex h-[24px] items-center rounded-lg bg-emerald-500/10 px-2.5 text-[10px] font-black tracking-widest text-emerald-400 border border-emerald-500/10 uppercase">
              {admin.role.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Close Action */}
        <button
          onClick={onClose}
          className="mt-8 flex h-[48px] w-full items-center justify-center rounded-xl bg-white text-black font-bold hover:bg-[#00f2ff] hover:text-black transition-all active:scale-[0.98] text-sm"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
