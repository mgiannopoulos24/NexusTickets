import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';

import Home from '@/pages/Home';
import { event } from '@/tests/helpers/fixtures';
import { mockFetch } from '@/tests/helpers/mockFetch';
import { renderWithProviders, resetStore } from '@/tests/helpers/renderWithProviders';

let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  mockFetch({
    '/categories': () => [{ id: 'cat-theater', name: 'Θέατρο' }],
    '/events/search': () => [event()],
  });
  scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
});

/**
 * A real click is a pointerdown/pointerup pair. The drag-scroll wrapper used to
 * take pointer capture on pointerdown, which makes the browser retarget the
 * click to the scroller and never reach the tab — so the sequence matters here,
 * not just fireEvent.click.
 */
function realClick(el: HTMLElement) {
  fireEvent.pointerDown(el, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  fireEvent.pointerUp(el, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  fireEvent.click(el);
}

describe('Home category tabs', () => {
  it('scrolls to the matching slider when a tab is clicked', async () => {
    renderWithProviders(<Home />, { route: '/' });
    const tab = await screen.findByRole('button', { name: 'Μουσική' });

    await act(async () => {
      realClick(tab);
    });

    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('does not take pointer capture on a plain click', async () => {
    renderWithProviders(<Home />, { route: '/' });
    const tab = await screen.findByRole('button', { name: 'Μουσική' });
    const scroller = tab.closest('[class*="overflow-x-auto"]') as HTMLElement;
    const capture = vi.fn();
    scroller.setPointerCapture = capture;

    await act(async () => {
      realClick(tab);
    });

    // Capturing here is what stopped the click from reaching the tab.
    expect(capture).not.toHaveBeenCalled();
  });

  it('still swallows the click that ends a drag', async () => {
    renderWithProviders(<Home />, { route: '/' });
    const tab = await screen.findByRole('button', { name: 'Μουσική' });
    const scroller = tab.closest('[class*="overflow-x-auto"]') as HTMLElement;
    scroller.setPointerCapture = vi.fn();
    scroller.releasePointerCapture = vi.fn();

    await act(async () => {
      fireEvent.pointerDown(tab, {
        pointerId: 2,
        pointerType: 'mouse',
        button: 0,
        clientX: 10,
        clientY: 10,
      });
      fireEvent.pointerMove(scroller, {
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 120,
        clientY: 10,
      });
      fireEvent.pointerUp(scroller, {
        pointerId: 2,
        pointerType: 'mouse',
        button: 0,
        clientX: 120,
        clientY: 10,
      });
      fireEvent.click(tab);
    });

    expect(scrollTo).not.toHaveBeenCalled();
    expect(scroller.setPointerCapture).toHaveBeenCalled();
  });

  it('offers one tab per home slider', async () => {
    renderWithProviders(<Home />, { route: '/' });
    await screen.findByRole('button', { name: 'Μουσική' });
    for (const label of ['Δημοφιλή', 'Προτεινόμενα', 'Νέα', 'Θέατρο', 'Μουσική', 'Σινεμά']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the clicked tab as current', async () => {
    renderWithProviders(<Home />, { route: '/' });
    const tab = await screen.findByRole('button', { name: 'Θέατρο' });

    await act(async () => {
      realClick(tab);
    });

    expect(tab).toHaveAttribute('aria-current', 'true');
  });
});
