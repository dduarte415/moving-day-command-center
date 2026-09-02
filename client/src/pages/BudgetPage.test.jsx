import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BudgetPage from './BudgetPage';
import { mockApi, renderWithProviders, aMove, aBudgetItem, errorResponse } from '../test/helpers';

const summary = (over = {}) => ({ total: 750.5, paidTotal: 0, unpaidTotal: 750.5, budgetCap: null, ...over });

function renderBudget(routes = {}) {
  const mocks = mockApi({
    'GET /api/moves': [aMove()],
    'GET /api/budget-items': { items: [aBudgetItem()], summary: summary() },
    ...routes,
  });
  renderWithProviders(<BudgetPage />, { route: '/budget' });
  return mocks;
}

describe('BudgetPage', () => {
  it('renders the server-provided total rather than summing the rows itself', async () => {
    // The server total deliberately disagrees with the line items: the page
    // must show the server's number (security req #10 — the client never
    // asserts a total), which is what makes this assertion meaningful.
    renderBudget({
      'GET /api/budget-items': {
        items: [aBudgetItem({ amount: '10.00' }), aBudgetItem({ id: 'item-2', amount: '15.00' })],
        summary: summary({ total: 999.99, paidTotal: 0, unpaidTotal: 999.99 }),
      },
    });

    await waitFor(() => expect(screen.getAllByText(/\$999\.99/).length).toBeGreaterThan(0));
    expect(screen.queryByText(/\$25\.00/)).not.toBeInTheDocument();
  });

  it('shows spend against the cap when one is set', async () => {
    renderBudget({
      'GET /api/budget-items': {
        items: [aBudgetItem()],
        summary: summary({ total: 850, unpaidTotal: 850, budgetCap: 3000 }),
      },
    });

    await waitFor(() => expect(screen.getByText(/spent of/i)).toBeInTheDocument());
    expect(screen.getByText(/\$2,150\.00 remaining/i)).toBeInTheDocument();
  });

  it('reports how far over budget a move is instead of a negative remainder', async () => {
    renderBudget({
      'GET /api/budget-items': {
        items: [aBudgetItem()],
        summary: summary({ total: 3200, unpaidTotal: 3200, budgetCap: 3000 }),
      },
    });

    expect(await screen.findByText(/\$200\.00 over budget/i)).toBeInTheDocument();
    expect(screen.queryByText(/-\$200/)).not.toBeInTheDocument();
  });

  it('adopts the server summary after adding an item', async () => {
    const user = userEvent.setup();
    renderBudget({
      'POST /api/budget-items': {
        item: aBudgetItem({ id: 'item-2', label: 'Packing supplies', amount: '120.00' }),
        summary: summary({ total: 870.5, unpaidTotal: 870.5 }),
      },
    });

    await screen.findByText('Moving truck rental');
    await user.type(screen.getByPlaceholderText(/moving truck rental/i), 'Packing supplies');
    await user.type(screen.getByPlaceholderText('0.00'), '120');
    await user.click(screen.getByRole('button', { name: /add item/i }));

    expect(await screen.findByText('Packing supplies')).toBeInTheDocument();
    expect(screen.getAllByText(/\$870\.50/).length).toBeGreaterThan(0);
  });

  it('does not submit twice when the add button is double-clicked', async () => {
    const user = userEvent.setup();
    let resolvePost;
    const { calls } = renderBudget({
      'POST /api/budget-items': () =>
        new Promise((resolve) => {
          resolvePost = () => resolve({ item: aBudgetItem({ id: 'item-2' }), summary: summary() });
        }),
    });

    await screen.findByText('Moving truck rental');
    await user.type(screen.getByPlaceholderText(/moving truck rental/i), 'Boxes');
    await user.type(screen.getByPlaceholderText('0.00'), '20');

    const addButton = screen.getByRole('button', { name: /add item/i });
    await user.click(addButton);
    await user.click(addButton);
    resolvePost();

    await waitFor(() => {
      expect(calls.filter((c) => c.method === 'POST').length).toBe(1);
    });
  });

  it('confirms before deleting an item and keeps it when cancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { calls } = renderBudget();

    await screen.findByText('Moving truck rental');
    const row = screen.getByText('Moving truck rental').closest('li');
    await user.click(within(row).getByRole('button', { name: /actions/i }));
    await user.click(await screen.findByRole('button', { name: /delete/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(screen.getByText('Moving truck rental')).toBeInTheDocument();
  });

  it('shows an error state instead of a blank page when the budget fails to load', async () => {
    renderBudget({ 'GET /api/budget-items': errorResponse(500, 'Internal server error') });

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});
