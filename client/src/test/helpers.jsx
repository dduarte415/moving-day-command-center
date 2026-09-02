import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { MoveProvider } from '../context/MoveContext';

// Stubs global fetch against a table of `"METHOD /path"` -> response.
// Matching is by prefix so query strings don't have to be spelled out.
// Anything unmatched throws loudly rather than silently resolving, so a
// component quietly calling an endpoint the test didn't anticipate fails
// the test instead of hanging on a never-resolving promise.
export function mockApi(routes) {
  const calls = [];
  const fetchMock = vi.fn(async (url, options = {}) => {
    const method = (options.method ?? 'GET').toUpperCase();
    const path = String(url);
    calls.push({ method, path, body: options.body ? JSON.parse(options.body) : undefined });

    const key = Object.keys(routes).find((k) => {
      const [routeMethod, routePath] = k.split(' ');
      return routeMethod === method && path.startsWith(routePath);
    });
    if (!key) throw new Error(`Unmocked request: ${method} ${path}`);

    const handler = routes[key];
    const result = typeof handler === 'function' ? await handler({ method, path, options }) : handler;
    const { status = 200, body = result } = result?.__response ? result : { body: result };

    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => body,
    };
  });

  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

export const errorResponse = (status, error) => ({ __response: true, status, body: { error } });

export function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <MoveProvider>{ui}</MoveProvider>
    </MemoryRouter>
  );
}

export const aMove = (overrides = {}) => ({
  id: 'move-1',
  oldAddress: '123 old st, springfield, il 62701',
  newAddress: '456 oakland ave, novato, ca 94945',
  moveDate: '2026-09-20T00:00:00.000Z',
  budgetCap: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

export const aBudgetItem = (overrides = {}) => ({
  id: 'item-1',
  moveId: 'move-1',
  label: 'Moving truck rental',
  category: 'MOVERS',
  amount: '750.50',
  isPaid: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});
