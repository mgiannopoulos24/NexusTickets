import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n';

type ErrorMessageProps = {
  title?: string;
  message: string;
  className?: string;
  /** When provided, renders a "try again" button. */
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorMessage({
  title,
  message,
  className,
  onRetry,
  retryLabel = tr('common.retry'),
}: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900',
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-[var(--nexus-red)]" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="comfortaa-bold font-semibold">{title}</p> : null}
        <p className={cn('comfortaa-regular text-sm', title && 'mt-1')}>{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              'comfortaa-regular mt-2 rounded-lg border border-red-300 bg-white px-3 py-1 text-sm',
              'text-red-900 transition-colors hover:bg-red-100',
            )}
          >
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
