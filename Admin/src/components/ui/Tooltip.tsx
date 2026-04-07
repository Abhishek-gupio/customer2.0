import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  side?: 'right' | 'top' | 'bottom' | 'left';
  enabled?: boolean;
}

export function Tooltip({ children, content, side = 'right', enabled = true }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      if (side === 'right') {
        setCoords({
          top: rect.top + rect.height / 2,
          left: rect.right + 12,
        });
      }
    }
  };

  const handleEnter = () => {
    if (!enabled) return;
    updateCoords();
    setOpen(true);
  };

  return (
    <div 
      ref={triggerRef} 
      className="flex" 
      onMouseEnter={handleEnter} 
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && enabled && createPortal(
        <div 
          style={{ 
            top: coords.top, 
            left: coords.left,
            transform: 'translateY(-50%)'
          }}
          className={cn(
            "pointer-events-none fixed z-[9999] whitespace-nowrap rounded-lg border border-white/10 bg-[#050505] px-3 py-1.5 text-xs font-bold text-white shadow-[0_8px_30px_rgb(0,0,0,0.8)] backdrop-blur-md transition-all animate-in fade-in zoom-in-95"
          )}
        >
          {content}
          {/* Subtle Arrow */}
          <div className="absolute -left-[4px] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-l border-white/10 bg-[#050505]" />
        </div>,
        document.body
      )}
    </div>
  );
}
