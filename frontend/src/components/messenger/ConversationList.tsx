import { Search, PenSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types/message';

import { avatarClass, displayName, initials, roleLabel } from './participant';
import { listTimestamp } from './timeFormat';

type ConversationListProps = {
  conversations: Conversation[];
  activeUserId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (userId: string) => void;
  onCompose: () => void;
  isLoading: boolean;
};

export function ConversationList({
  conversations,
  activeUserId,
  query,
  onQueryChange,
  onSelect,
  onCompose,
  isLoading,
}: ConversationListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
        <h1 className="comfortaa-bold text-lg font-bold text-neutral-900">Μηνύματα</h1>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onCompose} title="Νέα συνομιλία">
          <PenSquare className="size-4" />
          <span className="sr-only">Νέα συνομιλία</span>
        </Button>
      </div>

      <div className="border-b border-neutral-200 px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Αναζήτηση συνομιλίας"
            aria-label="Αναζήτηση συνομιλίας"
            className="pl-8"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <p className="comfortaa-regular p-4 text-sm text-neutral-500">Φόρτωση…</p>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center">
            <p className="comfortaa-regular text-sm text-neutral-600">
              {query ? 'Καμία συνομιλία δεν ταιριάζει.' : 'Δεν υπάρχουν συνομιλίες ακόμη.'}
            </p>
            {!query && (
              <Button type="button" variant="outline" className="mt-3" onClick={onCompose}>
                Ξεκινήστε συνομιλία
              </Button>
            )}
          </div>
        ) : (
          <ul>
            {conversations.map((c) => {
              const active = c.user.id === activeUserId;
              const unread = c.unread_count > 0;
              return (
                <li key={c.user.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.user.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                      active ? 'bg-[#6d28d9]/10' : 'hover:bg-neutral-50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                        avatarClass(c.user.id),
                      )}
                      aria-hidden
                    >
                      {initials(c.user)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            'comfortaa-regular truncate text-sm text-neutral-900',
                            unread && 'font-bold',
                          )}
                        >
                          {displayName(c.user)}
                        </span>
                        <span className="comfortaa-regular shrink-0 text-[11px] text-neutral-500">
                          {listTimestamp(c.last_message.created_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'comfortaa-regular truncate text-xs',
                            unread ? 'font-medium text-neutral-800' : 'text-neutral-500',
                          )}
                        >
                          {c.last_message.body}
                        </span>
                        {unread && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#6d28d9] text-[11px] font-semibold text-white">
                            {c.unread_count > 9 ? '9+' : c.unread_count}
                          </span>
                        )}
                      </span>
                      <span className="comfortaa-regular mt-0.5 block text-[11px] text-neutral-400">
                        {roleLabel(c.user, c.support)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
