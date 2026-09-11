import { vi } from 'vitest';

export type Handler = (url: string, init?: RequestInit) => unknown;

export type FetchCall = { url: string; method: string; body: unknown };

export type MockFetch = {
  /** Every request the app made, in order. */
  calls: FetchCall[];
  /** Requests whose URL contains `fragment`. */
  matching: (fragment: string) => FetchCall[];
  /** Registers/overrides the response for URLs containing `fragment`. */
  on: (fragment: string, handler: Handler) => void;
  /** Makes matching URLs fail with `status` and an `{error}` envelope. */
  fail: (match: string | RegExp, status: number, message?: string) => void;
};

/**
 * Installs a fetch stub that answers by URL fragment. Anything unmatched comes
 * back as an empty list envelope, so a test only declares the endpoints it
 * cares about.
 */
export function mockFetch(routes: Record<string, unknown> = {}): MockFetch {
  const calls: FetchCall[] = [];
  const handlers = new Map<string, Handler>();
  const failures: { match: string | RegExp; status: number; message: string }[] = [];

  for (const [fragment, value] of Object.entries(routes)) {
    handlers.set(fragment, typeof value === 'function' ? (value as Handler) : () => value);
  }

  // A handler normally returns just the payload. One that needs to control
  // the envelope's `meta` (pagination totals) returns `{ data, meta }` itself.
  const isEnvelope = (value: unknown): value is { data: unknown; meta: unknown } =>
    typeof value === 'object' && value !== null && 'data' in value && 'meta' in value;
  const envelope = (result: unknown) =>
    isEnvelope(result)
      ? { data: result.data, error: null, meta: result.meta }
      : { data: result, error: null, meta: { has_more: false } };

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // fetchBaseQuery hands fetch a single Request object rather than
      // (url, init), so the method and body have to be read off that.
      const request = input instanceof Request ? input : null;
      const url = request ? request.url : String(input);
      const method = (request?.method ?? init?.method ?? 'GET').toUpperCase();

      let raw: string | null = null;
      if (request) {
        raw = await request
          .clone()
          .text()
          .catch(() => null);
      } else if (typeof init?.body === 'string') {
        raw = init.body;
      }

      let body: unknown = null;
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
      }
      calls.push({ url, method, body });

      for (const failure of failures) {
        const hit =
          typeof failure.match === 'string' ? url.includes(failure.match) : failure.match.test(url);
        if (hit) {
          return new Response(
            JSON.stringify({ data: null, error: { code: 'error', message: failure.message } }),
            { status: failure.status, headers: { 'content-type': 'application/json' } },
          );
        }
      }

      for (const [fragment, handler] of handlers) {
        if (url.includes(fragment)) {
          return new Response(JSON.stringify(envelope(handler(url, init))), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify(envelope([])), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );

  return {
    calls,
    matching: (fragment) => calls.filter((c) => c.url.includes(fragment)),
    on: (fragment, handler) => handlers.set(fragment, handler),
    fail: (match, status, message = 'failed') => failures.push({ match, status, message }),
  };
}
