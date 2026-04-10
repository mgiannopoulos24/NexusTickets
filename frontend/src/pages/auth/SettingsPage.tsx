import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε τον λογαριασμό σας; Αυτή η ενέργεια είναι μη αναστρέψιμη.')) {
      return;
    }
    toast.error('Η διαγραφή λογαριασμού δεν είναι διαθέσιμη αυτή τη στιγμή');
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6">
          <Link to="/account" className="text-sm text-neutral-500 hover:text-[#6d28d9] comfortaa-regular">
            ← Επιστροφή στον λογαριασμό
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900 comfortaa-bold">Ρυθμίσεις</h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900 comfortaa-bold">Ασφάλεια</h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              Διαχειριστείτε τον κωδικό πρόσβασης και τις ρυθμίσεις ασφαλείας του λογαριασμού σας.
            </p>
            <Button
              variant="outline"
              className="mt-4 border-neutral-300 text-neutral-700 comfortaa-regular"
              disabled
            >
              Αλλαγή κωδικού
            </Button>
            <p className="mt-2 text-xs text-neutral-400 comfortaa-regular">Δεν είναι διαθέσιμο ακόμα</p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900 comfortaa-bold">Ειδοποιήσεις</h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              Διαχειριστείτε τις ειδοποιήσεις που λαμβάνετε.
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-neutral-300" />
                <span className="text-sm text-neutral-700 comfortaa-regular">Email για νέες κρατήσεις</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-neutral-300" />
                <span className="text-sm text-neutral-700 comfortaa-regular">Email για νέα μηνύματα</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-neutral-300" />
                <span className="text-sm text-neutral-700 comfortaa-regular">Email για ακυρώσεις εκδηλώσεων</span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900 comfortaa-bold">Απόρρητο</h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              Διαχειριστείτε τις ρυθμίσεις απορρήτου του λογαριασμού σας.
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4 rounded border-neutral-300" />
                <span className="text-sm text-neutral-700 comfortaa-regular">Εμφάνιση προφίλ σε δημόσια αναζήτηση</span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900 comfortaa-bold">Λογαριασμός</h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              Διαχειριστείτε τον λογαριασμό σας.
            </p>
            <div className="mt-4 space-y-3">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full border-neutral-300 text-neutral-700 hover:bg-neutral-50 comfortaa-regular"
              >
                Αποσύνδεση
              </Button>
              <Button
                onClick={handleDeleteAccount}
                variant="ghost"
                className="w-full text-red-600 hover:bg-red-50 comfortaa-regular"
              >
                Διαγραφή λογαριασμού
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}