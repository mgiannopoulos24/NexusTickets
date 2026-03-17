import { Header } from './components/layout/Header';

function App() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <p className="text-sm text-muted-foreground">Αρχική σελίδα (placeholder).</p>
        </div>
      </main>
    </>
  );
}

export default App;
