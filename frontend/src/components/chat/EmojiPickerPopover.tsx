import { useState, useRef, useEffect } from 'react';
import Picker from 'emoji-picker-react';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmojiPickerPopoverProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPickerPopover({ onEmojiSelect }: EmojiPickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="text-neutral-500"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <Smile className="size-5" />
      </Button>
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50">
          <Picker onEmojiClick={(emoji) => { onEmojiSelect(emoji.emoji); setIsOpen(false); }} />
        </div>
      )}
    </div>
  );
}