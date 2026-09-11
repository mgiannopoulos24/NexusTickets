import { tr } from '@/lib/i18n';
/**
 * Downloads an authenticated file from the API and saves it via the browser.
 *
 * The admin catalogue export endpoints (Req 12) require a Bearer token, so a
 * plain <a href> download does not work — we fetch with the Authorization
 * header, then trigger a save from the resulting Blob.
 */
export async function downloadAuthenticatedFile(
  url: string,
  accessToken: string,
  filename: string,
): Promise<void> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(tr('errors.exportFailed', { status: res.status }));
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
