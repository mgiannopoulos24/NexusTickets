import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLang } from '@/contexts/langContext';

export default function SettingsPage() {
  const { t } = useLang();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t('settings.confirmDelete'))) {
      return;
    }
    toast.error(t('settings.deleteUnavailable'));
  };

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6">
          <Link
            to="/account"
            className="text-sm text-neutral-500 hover:text-[var(--nexus-purple)] comfortaa-regular"
          >
            {t('settings.backToAccount')}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900 comfortaa-bold">
            {t('settings.title')}
          </h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900 comfortaa-bold">
              {t('settings.security')}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              {t('settings.securityHint')}
            </p>
            <Button
              variant="outline"
              className="mt-4 border-neutral-300 text-neutral-700 comfortaa-regular"
              disabled
            >
              {t('settings.changePassword')}
            </Button>
            <p className="mt-2 text-xs text-neutral-400 comfortaa-regular">
              {t('settings.notYet')}
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900 comfortaa-bold">
              {t('settings.notifications')}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              {t('settings.notificationsHint')}
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <span className="text-sm text-neutral-700 comfortaa-regular">
                  {t('settings.emailBookings')}
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <span className="text-sm text-neutral-700 comfortaa-regular">
                  {t('settings.emailMessages')}
                </span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <span className="text-sm text-neutral-700 comfortaa-regular">
                  {t('settings.emailCancellations')}
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900 comfortaa-bold">
              {t('settings.privacy')}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              {t('settings.privacyHint')}
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4 rounded border-neutral-300" />
                <span className="text-sm text-neutral-700 comfortaa-regular">
                  {t('settings.publicProfile')}
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-neutral-900 comfortaa-bold">
              {t('settings.account')}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 comfortaa-regular">
              {t('settings.accountHint')}
            </p>
            <div className="mt-4 space-y-3">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full border-neutral-300 text-neutral-700 hover:bg-neutral-50 comfortaa-regular"
              >
                {t('settings.logout')}
              </Button>
              <Button
                onClick={handleDeleteAccount}
                variant="ghost"
                className="w-full text-red-600 hover:bg-red-50 comfortaa-regular"
              >
                {t('settings.deleteAccount')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
