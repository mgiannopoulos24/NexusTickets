import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { Event } from '@/types/models';
import { cn } from '@/lib/utils';
import { downloadAuthenticatedFile } from '@/lib/downloadExport';

type ApiEnvelope<T> = {
  data: T | null;
  error?: { code: string; message: string } | null;
  meta?: unknown;
};

export default function AdminEventsPage() {
  const { accessToken } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'xml' | 'json' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: 'xml' | 'json') => {
    if (!accessToken) {
      setExportError('missing bearer token');
      return;
    }
    setExporting(format);
    setExportError(null);
    try {
      await downloadAuthenticatedFile(
        `/api/v1/events/export/${format}`,
        accessToken,
        `events.${format}`,
      );
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Σφάλμα εξαγωγής');
    } finally {
      setExporting(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    if (!accessToken) {
      setError('missing bearer token');
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void fetch('/api/v1/events/admin?limit=50&offset=0', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (res) => {
        const json = (await res.json()) as ApiEnvelope<Event[]>;
        if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Σφάλμα φόρτωσης');
        if (!cancelled) setEvents(json.data ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Σφάλμα');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <AdminLayout>
      <div className="bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-950 comfortaa-bold">Εκδηλώσεις</h1>
            <p className="mt-2 text-sm text-neutral-600 comfortaa-regular">
              Διαχείριση εκδηλώσεων και κατηγοριών.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting !== null}
              onClick={() => void handleExport('xml')}
            >
              {exporting === 'xml' ? 'Εξαγωγή…' : 'Εξαγωγή XML'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting !== null}
              onClick={() => void handleExport('json')}
            >
              {exporting === 'json' ? 'Εξαγωγή…' : 'Εξαγωγή JSON'}
            </Button>
          </div>
        </div>
        {exportError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">
            {exportError}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-neutral-600 comfortaa-regular">Φόρτωση…</p>
        ) : error ? (
          <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">
            {error}
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200">
            <div className="grid grid-cols-[minmax(0,1fr)_140px_220px] gap-0 bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600 comfortaa-regular">
              <div>Τίτλος</div>
              <div>Κατάσταση</div>
              <div>Ημερομηνίες</div>
            </div>
            <ul className="divide-y divide-neutral-200">
              {events.map((ev) => (
                <li key={ev.id} className="px-4 py-3">
                  <Link
                    to={`/admin/events/${encodeURIComponent(ev.id)}/edit`}
                    className={cn('grid grid-cols-[minmax(0,1fr)_140px_220px] items-center gap-0')}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-900 comfortaa-regular">
                        {ev.title}
                      </p>
                      <p className="truncate text-xs text-neutral-500 comfortaa-regular">
                        {ev.venue} • {ev.city}
                      </p>
                    </div>
                    <div className="text-xs text-neutral-700 comfortaa-regular">{ev.status}</div>
                    <div className="text-xs text-neutral-700 comfortaa-regular">
                      {new Date(ev.start_at).toLocaleDateString('el-GR')} –{' '}
                      {new Date(ev.end_at).toLocaleDateString('el-GR')}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
