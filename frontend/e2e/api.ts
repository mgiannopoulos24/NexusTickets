import { request, type APIRequestContext, type Page } from '@playwright/test';

/** A signed-in account the journeys act as. */
export type Account = { id: string; username: string; password: string; token: string };

const PASSWORD = 'E2e-pass-123';
let seq = 0;

export const unique = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function api(baseURL: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL: `${baseURL}/api/v1/`, ignoreHTTPSErrors: true });
}

async function json<T>(res: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  if (!res.ok()) throw new Error(`${res.url()} → ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return (body && typeof body === 'object' && 'data' in body ? body.data : body) as T;
}

export async function login(ctx: APIRequestContext, username: string, password: string) {
  const { access_token: token } = await json<{ access_token: string }>(
    await ctx.post('auth/login', { data: { username, password } }),
  );
  const me = await json<{ id: string }>(
    await ctx.get('users/me', { headers: { Authorization: `Bearer ${token}` } }),
  );
  return { id: me.id, username, password, token };
}

export async function admin(ctx: APIRequestContext): Promise<Account> {
  return login(
    ctx,
    process.env.E2E_ADMIN_USERNAME ?? 'admin',
    process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!',
  );
}

export const contact = {
  phone: '+30 210 1234567',
  address: 'Πανεπιστημίου 30',
  city: 'Αθήνα',
  country: 'Ελλάδα',
  vat_number: '123456789',
};

/** Registers an account through the API and has the admin approve it. */
export async function approvedUser(
  ctx: APIRequestContext,
  role: 'attendee' | 'organizer',
): Promise<Account> {
  const username = unique(role.slice(0, 3));
  const created = await json<{ id: string }>(
    await ctx.post('auth/register', {
      data: {
        username,
        password: PASSWORD,
        confirm_password: PASSWORD,
        first_name: 'E2E',
        last_name: role,
        email: `${username}@example.com`,
        role,
        ...contact,
      },
    }),
  );
  const boss = await admin(ctx);
  await json(
    await ctx.patch(`users/admin/${created.id}/approve`, {
      headers: { Authorization: `Bearer ${boss.token}` },
    }),
  );
  return login(ctx, username, PASSWORD);
}

export type EventInfo = { id: string; title: string; ticket_types: { id: string }[] };

/** Creates and publishes an event a month from now. */
export async function publishedEvent(
  ctx: APIRequestContext,
  org: Account,
  title = unique('E2E Συναυλία '),
): Promise<EventInfo> {
  const auth = { Authorization: `Bearer ${org.token}` };
  const start = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const end = new Date(start.getTime() + 2 * 3600 * 1000);
  const ev = await json<EventInfo>(
    await ctx.post('events/organizer', {
      headers: auth,
      data: {
        title,
        description: 'Εκδήλωση για τα end-to-end τεστ.',
        venue: 'Μέγαρο Μουσικής',
        address: 'Βασιλίσσης Σοφίας 1',
        event_type: 'concert',
        city: 'Αθήνα',
        country: 'Ελλάδα',
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        capacity: 50,
        categories: ['Μουσική'],
        ticket_types: [{ name: 'Κανονικό', price: 15, quantity: 50 }],
      },
    }),
  );
  await json(await ctx.patch(`events/organizer/${ev.id}/publish`, { headers: auth }));
  return ev;
}

/** Holds and confirms one ticket. */
export async function confirmedBooking(ctx: APIRequestContext, who: Account, ev: EventInfo) {
  const auth = { Authorization: `Bearer ${who.token}` };
  const b = await json<{ id: string }>(
    await ctx.post('bookings', {
      headers: auth,
      data: { event_id: ev.id, ticket_type_id: ev.ticket_types[0].id, quantity: 1 },
    }),
  );
  await json(await ctx.patch(`bookings/${b.id}/confirm`, { headers: auth }));
}

export async function sendMessage(
  ctx: APIRequestContext,
  from: Account,
  to: Account,
  subject: string,
) {
  await json(
    await ctx.post('messages', {
      headers: { Authorization: `Bearer ${from.token}` },
      data: { recipient_id: to.id, subject, body: 'Μήνυμα από τα end-to-end τεστ.' },
    }),
  );
}

/** Signs in through the login form. */
export async function signInUI(page: Page, who: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Όνομα χρήστη').fill(who.username);
  await page.getByLabel('Κωδικός').fill(who.password);
  await page.getByRole('button', { name: 'Σύνδεση' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
