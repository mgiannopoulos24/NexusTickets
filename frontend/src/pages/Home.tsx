import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const QUICK_FILTERS = [
  'Δημοφιλή',
  'Προτεινόμενα',
  'Νέα',
  'Κατηγορίες',
  'Θέατρο',
  'Μουσική',
  'Σινεμά',
] as const;

const PLACEHOLDER_EVENTS = [
  { id: '1', title: 'Ρυθμός & Ήχος', subtitle: 'Live στο κέντρο' },
  { id: '2', title: 'ASTORIA', subtitle: 'Θεατρική παράσταση' },
  { id: '3', title: 'Summer Fest', subtitle: 'Μουσική βραδιά' },
  { id: '4', title: 'Κλασικό αριστούργημα', subtitle: 'Όπερα' },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Navbar />

      <section className="home-hero relative border-b border-neutral-100 md:h-[550px] md:overflow-hidden">
        {/* Desktop: lime panel from right column start to viewport edge (escapes max-width gap) */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden bg-[#d4f040] md:rounded-l-full md:block"
          style={{
            left:
              'calc(max(0px, (100vw - 1400px) / 2) + 2rem + var(--hero-left-col))',
          }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto grid h-full max-w-[1400px] grid-cols-1 gap-10 px-4 py-10 sm:px-6 md:grid-cols-[var(--hero-left-col)_minmax(0,1fr)] md:items-stretch md:gap-0 md:px-8 md:py-0">
          <div className="flex min-h-0 w-full flex-col justify-center md:min-h-[550px]">
            <div className="w-full min-w-0 max-w-[800px]">
              <h1 className="text-balance text-3xl comfortaa-bold tracking-tight text-[#000020]">
                Η επόμενη εμπειρία σου ξεκινάει εδώ
              </h1>
              <p className="mt-4 text-lg comfortaa-regular text-neutral-500 tracking-tight">
                Κλείσε τώρα το εισιτήριό σου εύκολα, γρήγορα και με ασφάλεια.
              </p>
              <div className="mt-8">
                <label htmlFor="home-search" className="sr-only">
                  Αναζήτηση
                </label>
                <div className="relative flex items-center">
                  <Search
                    className="pointer-events-none absolute left-5 size-5 text-indigo-500"
                    aria-hidden={true}
                  />
                  <Input
                    id="home-search"
                    type="search"
                    placeholder="Αναζήτηση εκδήλωσης, χώρου ή περιοχής"
                    className={cn(
                      'h-14 rounded-full border-0 bg-white pl-14 pr-6 text-[16px]',
                      'comfortaa-regular text-neutral-900 ring-0 placeholder:text-neutral-500',
                      'transition-shadow duration-300 ease-out motion-reduce:transition-none',
                      'shadow-[0_4px_14px_-4px_rgba(15,23,42,0.12),inset_0_0_0_1px_rgb(229_231_235)]',
                      'hover:shadow-[0_4px_14px_-4px_rgba(15,23,42,0.12),inset_0_0_0_1px_rgb(212_212_216)]',
                      'focus-visible:shadow-[0_4px_14px_-4px_rgba(15,23,42,0.14),inset_0_0_0_2px_#6d28d9]',
                      'focus-visible:ring-0 focus-visible:outline-none',
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="relative min-h-[280px] min-w-0 md:min-h-[550px]">
            {/* Mobile: lime fill in stacked column; md+ uses section-level panel flush to viewport right */}
            <div
              className="absolute inset-0 rounded-t-[2.5rem] bg-[#d4f040] md:hidden"
              aria-hidden
            />
            <div className="relative z-10 flex h-full min-h-[280px] items-center justify-center p-6 md:min-h-[550px] md:p-8">
              <div className="w-full h-full max-w-lg rounded-2xl border border-neutral-200/80 bg-white/95 p-6 text-neutral-900 shadow-sm backdrop-blur-sm md:p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 comfortaa-regular">
                  Προτεινόμενο
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight comfortaa-bold text-[#000020]">
                  Θεατρική σεζόν
                </p>
                <p className="mt-2 text-sm text-neutral-600 comfortaa-regular">
                  Ανακάλυψε παραστάσεις κοντά σου.
                </p>
                <Link
                  to="/events"
                  className="mt-5 inline-flex w-fit rounded-full bg-[#6d28d9] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 comfortaa-regular"
                >
                  Δες εκδηλώσεις
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav aria-label="Γρήγορα φίλτρα" className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8">
          {QUICK_FILTERS.map((label) => (
            <Link
              key={label}
              to="/events"
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors',
                'hover:bg-violet-50 hover:text-[#6d28d9]',
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neutral-950">Δημοφιλή</h2>
          <p className="mt-1 text-neutral-600">Τα αγαπημένα του κοινού αυτή την περίοδο.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLACEHOLDER_EVENTS.map((ev) => (
            <article
              key={ev.id}
              className="group overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm transition hover:shadow-md"
            >
              <Link to="/events" className="block">
                <div
                  className={cn(
                    'relative aspect-[4/5] bg-gradient-to-br from-violet-200 via-violet-400 to-purple-700',
                    'flex items-end p-4',
                  )}
                >
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2240%22%20height=%2240%22%20viewBox=%220%200%2040%2040%22%3E%3Cg%20fill=%22%23ffffff%22%20fill-opacity=%220.08%22%3E%3Cpath%20d=%22M0%2040h40V0H0v40zM20%2020h20v20H20z%22/%3E%3C/g%3E%3C/svg%3E')] opacity-40" />
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold text-white drop-shadow-sm">{ev.title}</h3>
                    <p className="text-sm text-white/90">{ev.subtitle}</p>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
