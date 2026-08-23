import { lazy, Suspense, useState } from 'react';
import { Smile } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// The emoji data set is large, so it is only fetched once someone opens it.
const Picker = lazy(() => import('emoji-picker-react'));

type EmojiPickerButtonProps = {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
};

export function EmojiPickerButton({ onSelect, disabled }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label="Εισαγωγή emoji"
        >
          <Smile className="size-5 text-neutral-500" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto border-none p-0">
        <Suspense
          fallback={
            <div className="comfortaa-regular p-4 text-sm text-neutral-500">Φόρτωση emoji…</div>
          }
        >
          <Picker
            onEmojiClick={(emoji) => {
              onSelect(emoji.emoji);
              setOpen(false);
            }}
            width={320}
            height={400}
            lazyLoadEmojis
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
