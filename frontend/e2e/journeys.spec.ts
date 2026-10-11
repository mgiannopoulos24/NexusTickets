import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  admin,
  api,
  approvedUser,
  confirmedBooking,
  contact,
  publishedEvent,
  sendMessage,
  signInUI,
  unique,
  type Account,
  type EventInfo,
} from './api';

let ctx: APIRequestContext;
let org: Account;
let ev: EventInfo;

test.beforeAll(async ({ baseURL }) => {
  ctx = await api(baseURL!);
  org = await approvedUser(ctx, 'organizer');
  ev = await publishedEvent(ctx, org);
});

test.afterAll(async () => {
  await ctx.dispose();
});

// Address lookups go to the public OpenStreetMap geocoder; keep the suite
// off the network and independent of it.
test.beforeEach(async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/**', (route) =>
    route.fulfill({ json: [] }),
  );
});

async function fill(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).fill(value);
}

test('a newcomer registers, is approved, books and confirms (§2, §4, §9)', async ({
  page,
  browser,
}) => {
  const username = unique('fan');
  const password = 'E2e-pass-123';

  // Registration lands on the pending page.
  await page.goto('/register');
  await fill(page, 'Όνομα χρήστη *', username);
  await expect(page.getByText('Διαθέσιμο όνομα χρήστη')).toBeVisible();
  await fill(page, 'Κωδικός *', password);
  await fill(page, 'Επιβεβαίωση κωδικού *', password);
  await fill(page, 'Όνομα *', 'Μαρία');
  await fill(page, 'Επώνυμο *', 'Παπαδοπούλου');
  await fill(page, 'Email *', `${username}@example.com`);
  await fill(page, 'Τηλέφωνο *', contact.phone);
  await fill(page, 'ΑΦΜ *', contact.vat_number);
  await fill(page, 'Διεύθυνση *', contact.address);
  await fill(page, 'Πόλη *', contact.city);
  await fill(page, 'Χώρα *', contact.country);
  await page.getByRole('button', { name: 'Εγγραφή' }).click();
  await page.waitForURL('**/register/pending');

  // The admin approves the account from the user's page.
  const adminPage = await browser.newPage();
  const boss = await admin(ctx);
  await signInUI(adminPage, { username: boss.username, password: boss.password });
  await adminPage.waitForURL('**/admin/users');
  const users = await ctx.get('users/admin?limit=200&offset=0', {
    headers: { Authorization: `Bearer ${boss.token}` },
  });
  const listed = (await users.json()).data as { id: string; username: string }[];
  const newcomer = listed.find((u) => u.username === username);
  expect(newcomer, 'the new account is listed for the admin').toBeTruthy();
  await adminPage.goto(`/admin/users/${newcomer!.id}`);
  await adminPage.getByRole('button', { name: 'Έγκριση' }).first().click();
  await expect(adminPage.getByText('Εγκεκριμένος').first()).toBeVisible();
  await adminPage.close();

  // Signed in, the attendee holds a seat and confirms it.
  await signInUI(page, { username, password });
  await page.goto(`/events/${ev.id}`);
  await page.getByRole('radio', { name: /Κανονικό/ }).click();
  await page.getByRole('button', { name: 'Κράτηση Εισιτηρίων' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('timer')).toContainText('Οι θέσεις δεσμεύονται για');
  await dialog.getByRole('button', { name: 'Επιβεβαίωση & Κράτηση' }).click();
  await expect(page.getByText('Η κράτηση ολοκληρώθηκε με επιτυχία!')).toBeVisible();

  await page.goto('/bookings/me');
  const row = page.getByRole('listitem').filter({ hasText: ev.title });
  await expect(row).toContainText('Επιβεβαιωμένη');
  // A confirmed booking opens the line to the organizer (§10).
  await expect(row.getByRole('link', { name: /Μήνυμα στον διοργανωτή/ })).toBeVisible();
});

test('the organizer sees who booked their event (§7β, §7δ)', async ({ page }) => {
  const fan = await approvedUser(ctx, 'attendee');
  await confirmedBooking(ctx, fan, ev);

  await signInUI(page, org);
  await page.goto(`/organizer/events/${ev.id}/bookings`);
  await expect(page.getByText(fan.username).first()).toBeVisible();
});

test('a new message reaches the recipient live over the WebSocket (§10)', async ({ page }) => {
  const fan = await approvedUser(ctx, 'attendee');
  await confirmedBooking(ctx, fan, ev);

  await signInUI(page, org);
  await page.goto('/');
  const menu = page.getByRole('button', { name: /Μενού λογαριασμού/ }).first();
  await expect(menu).toBeVisible();
  // Let the socket connect before the message is sent.
  await page.waitForTimeout(1000);

  await sendMessage(ctx, fan, org, unique('Ερώτηση '));
  // No reload: the badge updates from the push.
  await expect(menu).toHaveAccessibleName(/1 νέα μηνύματα/);
});

test('hero search results sit above the category strip', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').fill(ev.title.slice(0, 12));
  await expect(page.getByRole('option').first()).toBeVisible();

  // The panel reaches down past the hero, over the sticky category strip.
  // Whatever is drawn at the centre of each result, and of the "see all"
  // link at the very bottom, must be that element and not the strip.
  const targets = [
    ...(await page.getByRole('option').all()),
    page.getByRole('link', { name: /Όλα τα αποτελέσματα/ }),
  ];
  for (const target of targets) {
    await target.scrollIntoViewIfNeeded();
    const onTop = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && el.contains(hit);
    });
    expect(onTop, `${await target.textContent()} is covered`).toBe(true);
  }
});

test('the admin exports the catalogue as XML (§12)', async ({ page }) => {
  const boss = await admin(ctx);
  await signInUI(page, { username: boss.username, password: boss.password });
  await page.goto('/admin/events');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Εξαγωγή XML' }).click();
  const file = await download;
  const path = await file.path();
  const fs = await import('node:fs/promises');
  const xml = await fs.readFile(path!, 'utf8');
  expect(xml).toContain('<Events');
  expect(xml).toContain(`EventID="${ev.id}"`);
});
