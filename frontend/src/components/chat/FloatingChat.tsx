import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';

import { useListConversationsQuery } from '@/app/messagesApi';
import { avatarClass, displayName, initials } from '@/components/messenger/participant';
import { listTimestamp } from '@/components/messenger/timeFormat';
import { cn } from '@/lib/utils';

/**
 * A shortcut into the messenger. It reads the same conversation list as
 * /messages and links into a thread, rather than holding a second, divergent
 * chat implementation.
 */
export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: conversations = [], isLoading } = useListConversationsQuery(undefined, {
    skip: !isOpen,
  });

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex size-14 items-center justify-center rounded-full bg-[#6d28d9] text-white shadow-lg transition-all hover:bg-[#5b21b6]"
        aria-label="Άνοιγμα μηνυμάτων"
      >
        <MessageCircle className="size-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="comfortaa-bold font-semibold text-neutral-900">
          Μηνύματα
          {unreadTotal > 0 && (
            <span className="ml-2 rounded-full bg-[#6d28d9] px-2 py-0.5 text-xs text-white">
              {unreadTotal}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-full p-1 hover:bg-neutral-100"
          aria-label="Κλείσιμο μηνυμάτων"
        >
          <X className="size-5 text-neutral-500" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <p className="comfortaa-regular p-4 text-center text-sm text-neutral-500">Φόρτωση…</p>
        ) : conversations.length === 0 ? (
          <p className="comfortaa-regular p-4 text-center text-sm text-neutral-500">
            Δεν υπάρχουν συνομιλίες ακόμη.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {conversations.slice(0, 8).map((c) => (
              <li key={c.user.id}>
                <Link
                  to={`/messages?to=${encodeURIComponent(c.user.id)}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 p-3 hover:bg-neutral-50"
                >
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      avatarClass(c.user.id),
                    )}
                    aria-hidden
                  >
                    {initials(c.user)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="comfortaa-regular truncate text-sm font-medium text-neutral-900">
                        {displayName(c.user)}
                      </span>
                      <span className="comfortaa-regular shrink-0 text-[11px] text-neutral-400">
                        {listTimestamp(c.last_message.created_at)}
                      </span>
                    </span>
                    <span className="comfortaa-regular mt-0.5 block truncate text-xs text-neutral-500">
                      {c.last_message.body}
                    </span>
                  </span>
                  {c.unread_count > 0 && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#6d28d9] text-[11px] text-white">
                      {c.unread_count > 9 ? '9+' : c.unread_count}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        to="/messages"
        onClick={() => setIsOpen(false)}
        className="comfortaa-regular block border-t border-neutral-200 px-4 py-2.5 text-center text-sm font-medium text-[#6d28d9] hover:bg-neutral-50"
      >
        Όλα τα μηνύματα
      </Link>
    </div>
  );
}
