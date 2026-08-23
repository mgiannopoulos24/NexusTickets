import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export default function PendingApprovalPage() {
  return (
    <div className="bg-[var(--nexus-lightgray)]/40">
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950 comfortaa-bold">
            Η εγγραφή σας υποβλήθηκε
          </h1>
          <p className="mt-2 text-sm text-neutral-600 comfortaa-regular">
            Ο λογαριασμός σας βρίσκεται σε κατάσταση <span className="font-medium">αναμονής</span>{' '}
            και απαιτεί έγκριση από διαχειριστή.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-700 comfortaa-regular">
            Μόλις εγκριθεί η εγγραφή σας, θα μπορείτε να συνδεθείτε κανονικά.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              className="w-full bg-[#6d28d9] text-white hover:bg-[#5b21b6] sm:w-auto comfortaa-regular"
            >
              <Link to="/login">Μετάβαση στη σύνδεση</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="w-full sm:w-auto comfortaa-regular"
            >
              <Link to="/">Επιστροφή στην αρχική</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
