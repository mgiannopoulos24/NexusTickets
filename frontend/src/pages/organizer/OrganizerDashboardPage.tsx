import { Link } from 'react-router-dom';

import { OrganizerLayout } from '@/components/layout/OrganizerLayout';
import { Button } from '@/components/ui/button';

export default function OrganizerDashboardPage() {
  return (
    <OrganizerLayout>
      <div className="bg-white p-6">
        <h1 className="text-2xl font-bold text-neutral-950 comfortaa-bold">Πίνακας διοργανωτή</h1>
        <p className="mt-2 max-w-2xl text-neutral-600 comfortaa-regular">
          Δημιουργήστε και διαχειριστείτε τις εκδηλώσεις σας. Οι εκδηλώσεις σε κατάσταση πρόχειρο
          δεν εμφανίζονται στη δημόσια αναζήτηση μέχρι να τις δημοσιεύσετε.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            asChild
            className="rounded-none border-2 border-[#6d28d9] bg-[#6d28d9] px-4 py-2 text-white hover:bg-[#5b21b6] comfortaa-regular"
          >
            <Link to="/organizer/events/new">Νέα εκδήλωση</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-none border-2 border-neutral-300 bg-transparent px-4 py-2 comfortaa-regular"
          >
            <Link to="/organizer/events">Οι εκδηλώσεις μου</Link>
          </Button>
        </div>
      </div>
    </OrganizerLayout>
  );
}
