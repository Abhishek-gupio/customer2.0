import React from 'react';
import { X, AlertTriangle, LucideIcon } from 'lucide-react';
import Particles from '../Particles/Particles';
import { cn } from '../../lib/cn';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmIcon: LucideIcon;
  confirmVariant?: 'danger' | 'primary';
  isProcessing?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmIcon: ConfirmIcon,
  confirmVariant = 'danger',
  isProcessing = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-hidden">
      {/* Background Overlay with Particles */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={isProcessing ? undefined : onClose}
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
      <div className="relative w-full max-w-[360px] bg-[#0c0c0c]/90 backdrop-blur-2xl border border-white/10 rounded-[28px] p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 ease-out flex flex-col items-center text-center">
        {/* Close Button */}
        {!isProcessing && (
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Dynamic Icon with Glow */}
        <div className="relative mb-5">
          <div className={cn(
            "absolute inset-0 blur-2xl rounded-full",
            confirmVariant === 'danger' ? "bg-red-500/20" : "bg-[var(--accent)]/20"
          )} />
          <div className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-2xl border bg-gradient-to-br",
            confirmVariant === 'danger' 
              ? "from-red-500/20 to-red-500/5 border-red-500/20" 
              : "from-[var(--accent)]/20 to-[var(--accent)]/5 border-[var(--accent)]/20"
          )}>
            <AlertTriangle className={cn(
              "h-7 w-7",
              confirmVariant === 'danger' ? "text-red-500" : "text-[var(--accent)]"
            )} />
          </div>
        </div>

        {/* Content */}
        <h3 className="text-[22px] font-black tracking-tight text-white mb-1.5">
          {title}
        </h3>
        <p className="text-[14px] text-zinc-400 font-medium leading-relaxed mb-8 max-w-[240px]">
          {description}
        </p>

        {/* Actions */}
        <div className="flex flex-col w-full gap-2.5">
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={cn(
              "group relative flex h-[48px] w-full items-center justify-center overflow-hidden rounded-xl font-bold text-black transition-all active:scale-[0.98]",
              confirmVariant === 'danger' 
                ? "bg-white hover:bg-red-500 hover:text-white" 
                : "bg-white hover:bg-[var(--accent)] hover:text-white"
            )}
          >
            <div className="relative z-10 flex items-center gap-2">
              <ConfirmIcon className={cn("h-4 w-4", isProcessing && "animate-spin")} />
              <span className="text-sm">{confirmLabel}</span>
            </div>
          </button>
          
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex h-[48px] w-full items-center justify-center rounded-xl bg-white/5 border border-white/10 font-bold text-white hover:bg-white/10 transition-all active:scale-[0.98] text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
