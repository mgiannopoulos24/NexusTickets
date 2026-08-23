import { cn } from '@/lib/utils';

/** Three dots bouncing out of phase — the usual "still writing" cue. */
export function TypingIndicator({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      role="status"
      aria-label="Γράφει…"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-full bg-neutral-400 motion-reduce:animate-none"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '1s' }}
        />
      ))}
    </span>
  );
}
