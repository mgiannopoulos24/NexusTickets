import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

type LoadingSpinnerProps = {
  label?: string;
  className?: string;
  spinnerClassName?: string;
};

export function LoadingSpinner({
  label = 'Φόρτωση…',
  className,
  spinnerClassName,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 py-8', className)}
      role="status"
      aria-live="polite"
    >
      <Spinner className={cn('size-8 text-[#6d28d9]', spinnerClassName)} />
      {label ? <p className="text-sm text-neutral-600 comfortaa-regular">{label}</p> : null}
    </div>
  );
}
