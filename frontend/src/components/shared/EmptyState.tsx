import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? <Icon className="mb-3 size-10 text-neutral-400" aria-hidden /> : null}
      <p className="text-base font-semibold text-neutral-900 comfortaa-bold">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-neutral-600 comfortaa-regular">{description}</p>
      ) : null}
      {children ? <div className="mt-6 w-full max-w-sm">{children}</div> : null}
    </div>
  );
}
