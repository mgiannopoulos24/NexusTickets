import { Marquee } from '@/components/ui/marquee';

const categories: readonly string[] = [
  'Events',
  'Workshops',
  'Music',
  'Sports',
  'Tech',
  'Community',
];

export function TopBar() {
  return (
    <header
      className="sticky top-0 z-50 h-[50px] w-full"
      style={{ backgroundColor: 'var(--nexus-darkgray)' }}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center px-4">
        <Marquee className="h-[50px] p-0 w-full [--gap:24px]">
          {categories.map((category) => (
            <span
              key={category}
              className="flex h-full items-center whitespace-nowrap text-sm font-medium leading-none text-white/90"
            >
              {category}
            </span>
          ))}
        </Marquee>
      </div>
    </header>
  );
}
