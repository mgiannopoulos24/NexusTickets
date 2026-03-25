import { AdminLayout } from '@/components/layout/AdminLayout';

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-neutral-950 comfortaa-bold">Πίνακας διαχείρισης</h1>
        <p className="mt-2 max-w-2xl text-neutral-600 comfortaa-regular">
          Καλώς ήρθατε στην περιοχή διαχείρισης. Από εδώ μπορείτε να συντονίζετε χρήστες και
          εξαγωγές (XML/JSON) μέσω του API διαχειριστή.
        </p>
      </div>
    </AdminLayout>
  );
}
