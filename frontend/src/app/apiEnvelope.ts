/**
 * Every endpoint answers with the same envelope: `{ data, error, meta }`.
 * These helpers unwrap it once so each API slice does not repeat the shape.
 */
export type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
  meta?: unknown;
};

/** Returns the payload, or throws with the server's message. */
export function unwrap<T>(response: unknown): T {
  const body = response as ApiEnvelope<T>;
  if (body?.error) throw new Error(body.error.message || 'Σφάλμα αιτήματος');
  if (body?.data === null || body?.data === undefined) throw new Error('Άκυρη απάντηση');
  return body.data;
}

/** Like {@link unwrap}, but an absent payload becomes an empty list. */
export function unwrapList<T>(response: unknown): T[] {
  const body = response as ApiEnvelope<T[]>;
  if (body?.error) throw new Error(body.error.message || 'Σφάλμα αιτήματος');
  return body?.data ?? [];
}

/**
 * Pulls a readable message out of whatever RTK Query hands back — the server
 * envelope when there is one, otherwise the transport error.
 */
export function apiErrorMessage(err: unknown, fallback = 'Προέκυψε σφάλμα.'): string {
  if (!err) return fallback;

  if (typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data;
    if (typeof data === 'object' && data !== null && 'error' in data) {
      const inner = (data as { error?: { message?: string } }).error;
      if (inner?.message) return inner.message;
    }
    if (typeof data === 'string' && data.trim() !== '') return data;
  }

  if (typeof err === 'object' && 'error' in err) {
    const e = (err as { error?: unknown }).error;
    if (typeof e === 'string' && e.trim() !== '') return e;
  }

  if (err instanceof Error) return err.message;
  return fallback;
}
