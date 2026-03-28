import { cn } from '@/lib/utils';

type SkeletonListProps = {
  rows?: number;
  className?: string;
  rowClassName?: string;
};

export function SkeletonList({ rows = 5, className, rowClassName }: SkeletonListProps) {
  return (
    <ul className={cn('flex flex-col gap-3', className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className={cn('h-12 animate-pulse rounded-lg bg-neutral-200/80', rowClassName)}
        />
      ))}
    </ul>
  );
}
