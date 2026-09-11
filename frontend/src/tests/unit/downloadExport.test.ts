import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadAuthenticatedFile } from '@/lib/downloadExport';

describe('downloadAuthenticatedFile', () => {
  const originalFetch = globalThis.fetch;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    // jsdom anchors: stub click so it doesn't try to navigate.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  it('sends the bearer token and triggers a download', async () => {
    const blob = new Blob(['<Events></Events>'], { type: 'application/xml' });
    const fetchMock = vi.fn(async () => new Response(blob, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await downloadAuthenticatedFile('/api/v1/events/export/xml', 'tok123', 'events.xml');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/events/export/xml', {
      headers: { Authorization: 'Bearer tok123' },
    });
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('nope', { status: 403 }),
    ) as unknown as typeof fetch;

    await expect(
      downloadAuthenticatedFile('/api/v1/events/export/xml', 'tok', 'events.xml'),
    ).rejects.toThrow(/403/);
  });
});
