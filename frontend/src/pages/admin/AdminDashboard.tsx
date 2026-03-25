export default function AdminDashboard() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-neutral-950">Πίνακας διαχείρισης</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Καλώς ήρθατε στην περιοχή διαχείρισης. Από εδώ μπορείτε να συντονίζετε χρήστες και
          εξαγωγές (XML/JSON) μέσω του API διαχειριστή.
        </p>
    </main>
  );
}
