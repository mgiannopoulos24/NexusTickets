import { useEffect, useState } from 'react';

import { wsClient } from '@/utils/wsClient';
import { WSMessageTypes } from '@/types/ws';

/** How long a typing hint keeps the dots visible before it lapses. */
const TYPING_TTL_MS = 4000;

/** Tells the recipient that we are composing a message to them. */
export function sendTypingHint(recipientId: string): void {
  wsClient.send({
    type: WSMessageTypes.typing,
    payload: { recipient_id: recipientId },
  });
}

/**
 * Turns the timestamp of the last typing hint into a boolean that switches
 * itself off, so the dots disappear when the other side goes quiet.
 */
export function useTypingSignal(lastHintAt: number | undefined): boolean {
  const [now, setNow] = useState(() => Date.now());

  const active = lastHintAt !== undefined && now - lastHintAt < TYPING_TTL_MS;

  useEffect(() => {
    if (lastHintAt === undefined) return;
    // Re-read the clock when this hint lapses; a hint already older than the
    // TTL still needs one tick to clear a stale `active`.
    const remaining = Math.max(0, TYPING_TTL_MS - (Date.now() - lastHintAt));
    const timer = window.setTimeout(() => setNow(Date.now()), remaining);
    return () => window.clearTimeout(timer);
  }, [lastHintAt]);

  return active;
}
