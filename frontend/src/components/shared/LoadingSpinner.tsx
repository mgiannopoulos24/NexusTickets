import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { tr } from '@/lib/i18n';

type LoadingSpinnerProps = {
  label?: string;
  className?: string;
  spinnerClassName?: string;
};

export function LoadingSpinner({
  label = tr('common.loading'),
  className,
  spinnerClassName,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-8', className)}
      role="status"
      aria-live="polite"
    >
      <Spinner className={cn('size-8 text-[var(--nexus-purple)]', spinnerClassName)} />
      {label ? <p className="text-sm text-neutral-600 comfortaa-regular">{label}</p> : null}
    </div>
  );
}
