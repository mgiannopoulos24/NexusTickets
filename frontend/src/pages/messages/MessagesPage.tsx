import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/message';

type ApiEnvelope<T> = { data: T | null; error?: { code: string; message: string } | null; meta?: unknown };

type Folder = 'inbox' | 'sent';

export default function MessagesPage() {
  const { accessToken } = useAuth();
  const [folder, setFolder] = useState<Folder>('inbox');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setError('missing bearer token');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/messages/${folder}?limit=50&offset=0`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await res.json()) as ApiEnvelope<Message[]>;
      if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Σφάλμα φόρτωσης');
      setMessages(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Σφάλμα');
    } finally {
      setLoading(false);
    }
  }, [accessToken, folder]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    // Optimistically remove; reload on failure.
    const previous = messages;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/v1/messages/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('delete failed');
    } catch {
      setMessages(previous);
      setError('Η διαγραφή απέτυχε');
    }
  };

  const isUnread = (m: Message): boolean => folder === 'inbox' && m.read_at === null;

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 comfortaa-bold">Μηνύματα</h1>
          <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
            Εισερχόμενα και απεσταλμένα μηνύματα.
          </p>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setFolder('inbox')}
            className={cn(
              'rounded-lg px-4 py-2 text-sm comfortaa-regular',
              folder === 'inbox'
                ? 'bg-[#6d28d9] text-white'
                : 'bg-white text-neutral-700 border border-neutral-200',
            )}
          >
            Εισερχόμενα
          </button>
          <button
            type="button"
            onClick={() => setFolder('sent')}
            className={cn(
              'rounded-lg px-4 py-2 text-sm comfortaa-regular',
              folder === 'sent'
                ? 'bg-[#6d28d9] text-white'
                : 'bg-white text-neutral-700 border border-neutral-200',
            )}
          >
            Απεσταλμένα
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-600 comfortaa-regular">Φόρτωση…</p>
        ) : error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--nexus-red)]">{error}</p>
        ) : messages.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-600 comfortaa-regular">
            {folder === 'inbox' ? 'Δεν έχετε εισερχόμενα μηνύματα.' : 'Δεν έχετε απεσταλμένα μηνύματα.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  'flex items-start justify-between gap-4 rounded-xl border bg-white px-4 py-3',
                  isUnread(m) ? 'border-[#6d28d9] bg-[#f5f3ff]' : 'border-neutral-200',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isUnread(m) && (
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#6d28d9]" aria-label="μη αναγνωσμένο" />
                    )}
                    <p className="truncate text-sm font-semibold text-neutral-900 comfortaa-bold">
                      {m.subject || '(χωρίς θέμα)'}
                    </p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-700 comfortaa-regular">{m.body}</p>
                  <p className="mt-1 text-xs text-neutral-500 comfortaa-regular">
                    {new Date(m.created_at).toLocaleString('el-GR')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(m.id)}
                  className="shrink-0 rounded-lg px-3 py-1 text-xs text-[var(--nexus-red)] hover:bg-red-50 comfortaa-regular"
                >
                  Διαγραφή
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
