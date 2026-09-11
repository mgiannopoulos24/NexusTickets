import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { Footer } from '@/components/layout/Footer';
import type { UserRole } from '@/types/enums';

const mockAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth(),
}));

function renderAs(role: UserRole | null) {
  mockAuth.mockReturnValue(
    role === null
      ? { user: null, isAuthenticated: false }
      : { user: { id: 'u1', username: 'someone', role }, isAuthenticated: true },
  );
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );
}

/** Reads the links under a footer column heading. */
function columnLinks(title: string): string[] {
  const heading = screen.getByRole('heading', { name: title });
  const column = heading.parentElement;
  if (!column) throw new Error(`no column for ${title}`);
  return within(column)
    .getAllByRole('link')
    .map((a) => a.textContent?.trim() ?? '');
}

describe('Footer', () => {
  it('keeps Πληροφορίες to the home link only, for every role', () => {
    for (const role of [null, 'attendee', 'organizer', 'admin'] as const) {
      const { unmount } = renderAs(role);
      expect(columnLinks('Πληροφορίες')).toEqual(['Αρχική']);
      unmount();
    }
  });

  it('offers a guest sign-in rather than support requests', () => {
    renderAs(null);
    expect(columnLinks('Υποστήριξη')).toEqual(['Σύνδεση', 'Εγγραφή']);
  });

  it('offers an attendee a new request and their own requests', () => {
    renderAs('attendee');
    expect(columnLinks('Υποστήριξη')).toEqual(['Νέο αίτημα', 'Τα αιτήματά μου']);
  });

  it('offers an organizer the same support entries', () => {
    renderAs('organizer');
    expect(columnLinks('Υποστήριξη')).toEqual(['Νέο αίτημα', 'Τα αιτήματά μου']);
  });

  it('points an admin at incoming requests instead', () => {
    renderAs('admin');
    expect(columnLinks('Υποστήριξη')).toEqual(['Αιτήματα χρηστών', 'Κλειστά αιτήματα']);
  });

  it('links a new request straight into the support ticket form', () => {
    renderAs('attendee');
    const link = screen.getByRole('link', { name: 'Νέο αίτημα' });
    expect(link).toHaveAttribute('href', '/support?new=1');
  });

  it('shows each role its own workspace column', () => {
    const cases: Array<[UserRole | null, string, string]> = [
      ['attendee', 'Ο λογαριασμός μου', 'Οι κρατήσεις μου'],
      ['organizer', 'Οι εκδηλώσεις μου', 'Νέα εκδήλωση'],
      ['admin', 'Διαχείριση', 'Χρήστες'],
      [null, 'Εξερεύνηση', 'Όλες οι εκδηλώσεις'],
    ];

    for (const [role, columnTitle, expectedLink] of cases) {
      const { unmount } = renderAs(role);
      expect(columnLinks(columnTitle)).toContain(expectedLink);
      unmount();
    }
  });

  it('never shows the admin dashboard to a non-admin', () => {
    for (const role of [null, 'attendee', 'organizer'] as const) {
      const { unmount } = renderAs(role);
      expect(screen.queryByRole('link', { name: /Πίνακας ελέγχου/ })).toBeNull();
      expect(screen.queryByRole('link', { name: /Χρήστες/ })).toBeNull();
      unmount();
    }
  });
});
