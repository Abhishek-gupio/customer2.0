import * as React from 'react';
import { cn } from '../../lib/cn';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-16 px-8 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-white/50">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-white/90">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-white/55">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
