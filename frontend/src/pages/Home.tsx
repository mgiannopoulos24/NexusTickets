import { Link } from "react-router-dom";
import { Search } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";

const QUICK_FILTERS = [
  "Δημοφιλή",
  "Προτεινόμενα",
  "Νέα",
  "Κατηγορίες",
  "Θέατρο",
  "Μουσική",
  "Σινεμά",
] as const;

const PLACEHOLDER_EVENTS = [
  { id: "1", title: "Ρυθμός & Ήχος", subtitle: "Live στο κέντρο" },
  { id: "2", title: "ASTORIA", subtitle: "Θεατρική παράσταση" },
  { id: "3", title: "Summer Fest", subtitle: "Μουσική βραδιά" },
  { id: "4", title: "Κλασικό αριστούργημα", subtitle: "Όπερα" },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Navbar />

      <section className="relative overflow-hidden border-b border-neutral-100">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-20">
          <div>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl lg:text-5xl">
              Η επόμενη εμπειρία σου ξεκινά εδώ
            </h1>
            <p className="mt-4 max-w-xl text-lg text-neutral-600">
              Κλείσε το εισιτήριό σου εύκολα, γρήγορα και με ασφάλεια.
            </p>
            <div className="mt-8">
              <label htmlFor="home-search" className="sr-only">
                Αναζήτηση
              </label>
              <div className="relative flex items-center">
                <Search
                  className="pointer-events-none absolute left-5 size-5 text-[#6d28d9]"
                  aria-hidden
                />
                <input
                  id="home-search"
                  type="search"
                  placeholder="Αναζήτηση εκδήλωσης, χώρου ή περιοχής"
                  className="h-14 w-full rounded-full border border-neutral-200 bg-white pl-14 pr-6 text-base text-neutral-900 shadow-sm outline-none ring-[#6d28d9]/20 transition-shadow placeholder:text-neutral-400 focus:border-[#6d28d9]/40 focus:ring-4"
                />
              </div>
            </div>
          </div>

          <div className="relative min-h-[280px] lg:min-h-[360px]">
            <div
              className="absolute -right-8 -top-4 h-[120%] w-[85%] rounded-[2.5rem] bg-gradient-to-br from-[#7c3aed] via-[#6d28d9] to-[#5b21b6] opacity-90 blur-px sm:right-0"
              aria-hidden
            />
            <div className="relative ml-auto flex h-full min-h-[260px] max-w-lg items-stretch overflow-hidden rounded-2xl border border-white/20 bg-neutral-900 shadow-2xl ring-1 ring-black/5 lg:ml-0">
              <div className="flex flex-1 flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-violet-900/40 p-6 text-white">
                <p className="text-xs font-medium uppercase tracking-wider text-violet-200">Προτεινόμενο</p>
                <p className="mt-1 text-2xl font-bold">Θεατρική σεζόν</p>
                <p className="mt-2 text-sm text-white/85">Ανακάλυψε παραστάσεις κοντά σου.</p>
                <Link
                  to="/events"
                  className="mt-4 inline-flex w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#5b21b6] transition hover:bg-violet-50"
                >
                  Δες εκδηλώσεις
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav
        aria-label="Γρήγορα φίλτρα"
        className="border-b border-neutral-200 bg-white"
      >
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8">
          {QUICK_FILTERS.map((label) => (
            <Link
              key={label}
              to="/events"
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors",
                "hover:bg-violet-50 hover:text-[#6d28d9]",
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
                    "relative aspect-[4/5] bg-gradient-to-br from-violet-200 via-violet-400 to-purple-700",
                    "flex items-end p-4",
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
