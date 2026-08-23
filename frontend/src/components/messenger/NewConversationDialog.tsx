import { useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { MessageRecipient } from '@/types/message';

import { avatarClass, initials } from './participant';

type NewConversationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipients: MessageRecipient[];
  onPick: (userId: string) => void;
};

export function NewConversationDialog({
  open,
  onOpenChange,
  recipients,
  onPick,
}: NewConversationDialogProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('el-GR');
    if (!q) return recipients;
    return recipients.filter((r) =>
      `${r.full_name} ${r.username}`.toLocaleLowerCase('el-GR').includes(q),
    );
  }, [recipients, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="comfortaa-bold">Νέα συνομιλία</DialogTitle>
          <DialogDescription className="comfortaa-regular">
            Μπορείτε να γράψετε στους διοργανωτές των εκδηλώσεων που κρατήσατε και στην υποστήριξη.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Αναζήτηση ατόμου"
          aria-label="Αναζήτηση ατόμου"
        />

        <ul className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="comfortaa-regular px-1 py-6 text-center text-sm text-neutral-600">
              {recipients.length === 0
                ? 'Δεν υπάρχουν διαθέσιμοι παραλήπτες ακόμη. Η επικοινωνία με διοργανωτή ανοίγει μετά από κράτηση.'
                : 'Κανένα αποτέλεσμα.'}
            </li>
          ) : (
            filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-neutral-100"
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      avatarClass(r.id),
                    )}
                    aria-hidden
                  >
                    {initials({ id: r.id, username: r.username, full_name: r.full_name, role: r.role })}
                  </span>
                  <span className="min-w-0">
                    <span className="comfortaa-regular block truncate text-sm text-neutral-900">
                      {r.full_name.trim() || r.username}
                    </span>
                    <span className="comfortaa-regular block truncate text-xs text-neutral-500">
                      {r.support ? 'Υποστήριξη' : r.role === 'organizer' ? 'Διοργανωτής' : 'Συμμετέχων'}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
