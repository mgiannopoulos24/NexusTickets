import { Link } from 'react-router-dom';
import { useState } from 'react';

import { apiErrorMessage } from '@/app/apiEnvelope';
import { useGetAdminEventsQuery } from '@/app/eventsApi';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorMessage } from '@/components/shared/ErrorMessage';
import { SkeletonList } from '@/components/shared/SkeletonList';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { downloadAuthenticatedFile } from '@/lib/downloadExport';
import type { EventStatus } from '@/types/enums';

const STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Πρόχειρο',
  published: 'Δημοσιευμένο',
  completed: 'Ολοκληρωμένο',
  cancelled: 'Ακυρωμένο',
  deleted: 'Διαγραμμένο',
};

const STATUS_COLOR: Record<EventStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-700',
  published: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-sky-100 text-sky-800',
  cancelled: 'bg-red-100 text-red-800',
  deleted: 'bg-neutral-100 text-neutral-500',
};

export default function AdminEventsPage() {
  const { accessToken } = useAuth();
  const { data: events, isLoading, error, refetch } = useGetAdminEventsQuery();

  const [exporting, setExporting] = useState<'xml' | 'json' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: 'xml' | 'json') => {
    if (!accessToken) {
      setExportError('Η συνεδρία έληξε. Συνδεθείτε ξανά.');
      return;
    }
    setExporting(format);
    setExportError(null);
    try {
      // The catalogue export lives under the admin group: /admin/events/export.
      await downloadAuthenticatedFile(
        `/api/v1/admin/events/export/${format}`,
        accessToken,
        `events.${format}`,
      );
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : 'Σφάλμα εξαγωγής');
    } finally {
      setExporting(null);
    }
  };

  return (
    <AdminLayout>
      <div className="bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="comfortaa-bold text-2xl font-bold text-neutral-950">Εκδηλώσεις</h1>
            <p className="comfortaa-regular mt-2 text-sm text-neutral-600">
              Διαχείριση εκδηλώσεων και εξαγωγή του καταλόγου.
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

        {exportError && <ErrorMessage className="mt-3" message={exportError} />}

        {isLoading ? (
          <SkeletonList rows={6} className="mt-6" />
        ) : error ? (
          <ErrorMessage
            className="mt-6"
            message={apiErrorMessage(error, 'Δεν ήταν δυνατή η φόρτωση των εκδηλώσεων.')}
            onRetry={() => void refetch()}
          />
        ) : (events ?? []).length === 0 ? (
          <EmptyState
            className="mt-6"
            title="Καμία εκδήλωση"
            description="Δεν υπάρχουν εκδηλώσεις στο σύστημα."
          />
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200">
            <div className="comfortaa-regular grid min-w-[38rem] grid-cols-[minmax(0,1fr)_150px_220px] bg-neutral-50 px-4 py-3 text-xs font-semibold text-neutral-600">
              <div>Τίτλος</div>
              <div>Κατάσταση</div>
              <div>Ημερομηνίες</div>
            </div>
            <ul className="min-w-[38rem] divide-y divide-neutral-200">
              {(events ?? []).map((ev) => (
                <li key={ev.id} className="px-4 py-3">
                  <Link
                    to={`/admin/events/${encodeURIComponent(ev.id)}/edit`}
                    className="grid grid-cols-[minmax(0,1fr)_150px_220px] items-center"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="comfortaa-regular truncate text-sm font-medium text-neutral-900">
                        {ev.title}
                      </p>
                      <p className="comfortaa-regular truncate text-xs text-neutral-500">
                        {ev.venue} • {ev.city}
                      </p>
                    </div>
                    <div className="text-xs">
                      <span
                        className={cn(
                          'comfortaa-regular inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_COLOR[ev.status] ?? 'bg-neutral-100 text-neutral-700',
                        )}
                      >
                        {STATUS_LABEL[ev.status] ?? ev.status}
                      </span>
                    </div>
                    <div className="comfortaa-regular text-xs text-neutral-700">
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
