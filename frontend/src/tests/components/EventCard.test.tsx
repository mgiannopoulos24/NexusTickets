import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import EventCard from '@/components/events/EventCard';
import { EVENT_ID, event, ticketType } from '@/tests/helpers/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

describe('EventCard', () => {
  it('shows the title, venue and city', () => {
    renderWithProviders(<EventCard event={event()} />);
    expect(screen.getByText('Συναυλία Κλασικής Μουσικής')).toBeInTheDocument();
    expect(screen.getByText('Μέγαρο Μουσικής, Αθήνα')).toBeInTheDocument();
  });

  it('advertises the cheapest ticket, not the first one', () => {
    renderWithProviders(
      <EventCard
        event={event({
          ticket_types: [ticketType({ price: 40 }), ticketType({ id: 'tt-2', price: 12 })],
        })}
      />,
    );
    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.queryByText(/40/)).not.toBeInTheDocument();
  });

  it('totals the seats left across ticket types', () => {
    renderWithProviders(
      <EventCard
        event={event({
          ticket_types: [
            ticketType({ available: 30 }),
            ticketType({ id: 'tt-2', available: 12 }),
          ],
        })}
      />,
    );
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('links to the event', () => {
    renderWithProviders(<EventCard event={event()} />);
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', `/events/${EVENT_ID}`);
  });

  it('shows at most two category badges plus an overflow count', () => {
    renderWithProviders(
      <EventCard event={event({ categories: ['Μουσική', 'Τέχνη', 'Θέατρο', 'Χορός'] })} />,
    );
    expect(screen.getByText('Μουσική')).toBeInTheDocument();
    expect(screen.getByText('Τέχνη')).toBeInTheDocument();
    expect(screen.queryByText('Θέατρο')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
