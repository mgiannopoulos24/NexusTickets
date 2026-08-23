import { useCallback, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const GIPHY_API_KEY = (import.meta.env.VITE_GIPHY_API_KEY as string | undefined) ?? '';
const GIPHY_ENDPOINT = 'https://api.giphy.com/v1/gifs';

type Gif = {
  id: string;
  title: string;
  preview: string;
  full: string;
};

type GiphyResponse = {
  data?: {
    id: string;
    title: string;
    images: {
      fixed_height_small?: { url: string };
      fixed_height?: { url: string };
    };
  }[];
};

function toGifs(payload: GiphyResponse): Gif[] {
  return (payload.data ?? [])
    .map((g) => ({
      id: g.id,
      title: g.title || 'GIF',
      preview: g.images.fixed_height_small?.url ?? g.images.fixed_height?.url ?? '',
      full: g.images.fixed_height?.url ?? g.images.fixed_height_small?.url ?? '',
    }))
    .filter((g) => g.full !== '');
}

type GifPickerButtonProps = {
  onSelect: (gifUrl: string) => void;
  disabled?: boolean;
};

export function GifPickerButton({ onSelect, disabled }: GifPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  // A later search must win even if an earlier one resolves after it.
  const requestId = useRef(0);

  const load = useCallback(async (term: string) => {
    if (!GIPHY_API_KEY) {
      setStatus('error');
      return;
    }
    const id = ++requestId.current;
    setStatus('loading');
    const path = term.trim()
      ? `${GIPHY_ENDPOINT}/search?q=${encodeURIComponent(term.trim())}&`
      : `${GIPHY_ENDPOINT}/trending?`;
    try {
      const res = await fetch(`${path}api_key=${GIPHY_API_KEY}&limit=24&rating=g`);
      if (!res.ok) throw new Error(String(res.status));
      const payload = (await res.json()) as GiphyResponse;
      if (id !== requestId.current) return;
      setGifs(toGifs(payload));
      setStatus('idle');
    } catch {
      if (id !== requestId.current) return;
      setStatus('error');
    }
  }, []);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Open on trending so the panel is never empty.
        if (next && gifs.length === 0) void load('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label="Εισαγωγή GIF"
        >
          <span className="text-[11px] font-bold tracking-tight text-neutral-500">GIF</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 p-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(query);
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση GIF"
            aria-label="Αναζήτηση GIF"
          />
          <Button type="submit" size="icon" aria-label="Αναζήτηση">
            <Search className="size-4" />
          </Button>
        </form>

        <div className="mt-3 max-h-64 overflow-y-auto">
          {status === 'error' ? (
            <p className="comfortaa-regular py-6 text-center text-sm text-neutral-600">
              {GIPHY_API_KEY
                ? 'Η αναζήτηση GIF απέτυχε.'
                : 'Δεν έχει ρυθμιστεί κλειδί Giphy (VITE_GIPHY_API_KEY).'}
            </p>
          ) : status === 'loading' ? (
            <p className="comfortaa-regular py-6 text-center text-sm text-neutral-500">Φόρτωση…</p>
          ) : gifs.length === 0 ? (
            <p className="comfortaa-regular py-6 text-center text-sm text-neutral-500">
              Κανένα αποτέλεσμα.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {gifs.map((gif) => (
                <li key={gif.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(gif.full);
                      setOpen(false);
                    }}
                    className="block w-full overflow-hidden rounded-lg transition hover:opacity-80"
                  >
                    <img
                      src={gif.preview}
                      alt={gif.title}
                      loading="lazy"
                      className="h-24 w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="comfortaa-regular mt-2 text-center text-[10px] text-neutral-400">
          Powered by GIPHY
        </p>
      </PopoverContent>
    </Popover>
  );
}
