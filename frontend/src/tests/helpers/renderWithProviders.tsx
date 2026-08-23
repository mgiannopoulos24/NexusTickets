import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';

import { clearAuth, setSession } from '@/app/authSlice';
import { clearFilters } from '@/app/eventsSlice';
import { store } from '@/app/store';
import { LangProvider } from '@/contexts/LangContext';
import { baseApi } from '@/utils/api';
import type { User } from '@/types/models';

/**
 * The app owns a single store, so each test starts by emptying the pieces a
 * previous test could have written: the RTK Query cache, the filter panel and
 * the session.
 */
export function resetStore(): void {
  store.dispatch(baseApi.util.resetApiState());
  store.dispatch(clearFilters());
  store.dispatch(clearAuth());
}

export type SignedInUser = Partial<User> & Pick<User, 'role'>;

export function signIn(user: SignedInUser): void {
  store.dispatch(
    setSession({
      accessToken: 'test-token',
      user: {
        id: 'u-1',
        username: 'tester',
        email: 'tester@example.com',
        first_name: 'Test',
        last_name: 'User',
        account_status: 'approved',
        ...user,
      } as User,
    }),
  );
}

type RenderOptions = {
  /** Initial URL; use with `path` when the component reads route params. */
  route?: string;
  /** Route pattern the element is mounted under (e.g. '/events/:id'). */
  path?: string;
  /**
   * Use the real history so a test can assert on window.location — MemoryRouter
   * keeps its location to itself.
   */
  browserRouter?: boolean;
};

/** Renders a component with the providers the real app wraps every page in. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path, browserRouter = false }: RenderOptions = {},
): RenderResult {
  const tree: ReactNode = path ? (
    <Routes>
      <Route path={path} element={ui} />
    </Routes>
  ) : (
    ui
  );

  if (browserRouter) {
    window.history.pushState({}, '', route);
  }

  const router = browserRouter ? (
    <BrowserRouter>{tree}</BrowserRouter>
  ) : (
    <MemoryRouter initialEntries={[route]}>{tree}</MemoryRouter>
  );

  return render(
    <Provider store={store}>
      <LangProvider>{router}</LangProvider>
    </Provider>,
  );
}
