import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

type ErrorMessageProps = {
  title?: string;
  message: string;
  className?: string;
};

export function ErrorMessage({ title, message, className }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-[var(--nexus-red)]" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-semibold comfortaa-bold">{title}</p> : null}
        <p className={cn('text-sm comfortaa-regular', title && 'mt-1')}>{message}</p>
      </div>
    </div>
  );
}
