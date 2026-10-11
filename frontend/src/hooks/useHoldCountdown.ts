import { useEffect, useState } from 'react';

/**
 * Seconds left until a booking hold lapses, ticking once a second. Null when
 * there is no hold to count down.
 */
export function useHoldCountdown(expiresAt: string | undefined | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setNow(Date.now());
    // The clock may have stood still since mount; catch up straight away.
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [expiresAt]);

  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now) / 1000));
}

/** Formats a number of seconds as m:ss. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
