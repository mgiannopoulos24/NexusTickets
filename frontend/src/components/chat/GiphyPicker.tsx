import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY as string;

interface GiphyPickerProps {
  onGifSelect: (gifUrl: string) => void;
}

interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_height_small: { url: string };
    fixed_height: { url: string };
  };
}

export function GiphyPicker({ onGifSelect }: GiphyPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(search)}&limit=20&rating=g`
      );
      const data = await res.json();
      setGifs(data.data || []);
    } catch (err) {
      console.error('Giphy search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="text-neutral-500"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        GIF
      </Button>
      {isOpen && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-72 bg-white rounded-lg shadow-xl border border-neutral-200 p-2">
          <div className="flex gap-1 mb-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search GIFs..."
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button size="icon" onClick={handleSearch}>
              <Search className="size-4" />
            </Button>
          </div>
          {loading ? (
            <p className="text-center text-neutral-500 py-4">Loading...</p>
          ) : (
            <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => { onGifSelect(gif.images.fixed_height.url); setIsOpen(false); }}
                  className="hover:opacity-80"
                >
                  <img src={gif.images.fixed_height_small.url} alt={gif.title} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}