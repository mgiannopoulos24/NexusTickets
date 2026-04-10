import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { User } from '@/types/models';

type ApiEnvelope<T> = { data: T | null; error?: { code: string; message: string } | null };

export default function AccountPage() {
  const { accessToken, setUser } = useAuth();
  const navigate = useNavigate();
  const [user, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    vat_number: '',
  });

  useEffect(() => {
    if (!accessToken) {
      navigate('/login');
      return;
    }
    setLoading(true);

    fetch('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        const json = (await res.json()) as ApiEnvelope<User>;
        if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Σφάλμα φόρτωσης');
        setUserData(json.data!);
        setForm({
          first_name: json.data!.first_name ?? '',
          last_name: json.data!.last_name ?? '',
          email: json.data!.email ?? '',
          phone: json.data!.phone ?? '',
          address: json.data!.address ?? '',
          city: json.data!.city ?? '',
          country: json.data!.country ?? '',
          vat_number: json.data!.vat_number ?? '',
        });
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Σφάλμα');
      })
      .finally(() => setLoading(false));

    return () => {};
  }, [accessToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    setSaving(true);
    try {
      const res = await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as ApiEnvelope<User>;
      if (!res.ok || json.error) throw new Error(json.error?.message ?? 'Σφάλμα αποθήκευσης');

      setUser(json.data!);
      toast.success('Τα στοιχεία ενημερώθηκαν');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Σφάλμα');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-8">
        <div className="mx-auto max-w-2xl px-4">
          <p className="text-neutral-500 comfortaa-regular">Φόρτωση...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 comfortaa-bold">Ο λογαριασμός μου</h1>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              Διαχειριστείτε τα προσωπικά σας στοιχεία
            </p>
          </div>
          <Link
            to="/settings"
            className="inline-flex shrink-0 items-center justify-center rounded-none border-2 border-[#6d28d9] bg-[#6d28d9] px-4 py-2 text-sm text-white hover:bg-[#5b21b6] comfortaa-regular"
          >
            Ρυθμίσεις
          </Link>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 text-xl font-bold text-neutral-600">
              {user?.first_name?.[0] || user?.username?.[0] || '?'}
            </div>
            <div>
              <p className="text-lg font-semibold text-neutral-900 comfortaa-regular">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-sm text-neutral-500 comfortaa-regular">@{user?.username}</p>
              <p className="text-xs text-neutral-400 comfortaa-regular">
                Ρόλος: {user?.role === 'admin' ? 'Διαχειριστής' : user?.role === 'organizer' ? 'Διοργανωτής' : 'Συμμετέχων'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="comfortaa-regular">Όνομα</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="comfortaa-regular"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="comfortaa-regular">Επώνυμο</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="comfortaa-regular"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="comfortaa-regular">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="comfortaa-regular"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="comfortaa-regular">Τηλέφωνο</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="comfortaa-regular"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="comfortaa-regular">Διεύθυνση</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="comfortaa-regular"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city" className="comfortaa-regular">Πόλη</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="comfortaa-regular"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country" className="comfortaa-regular">Χώρα</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="comfortaa-regular"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vat_number" className="comfortaa-regular">ΑΦΜ</Label>
              <Input
                id="vat_number"
                value={form.vat_number}
                onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
                className="comfortaa-regular"
              />
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full bg-[#6d28d9] text-white hover:bg-[#5b21b6] comfortaa-regular"
            >
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση αλλαγών'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}