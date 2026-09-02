import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChecklistPage from './ChecklistPage';
import { mockApi, renderWithProviders, aMove, errorResponse } from '../test/helpers';

const aTask = (overrides = {}) => ({
  id: 'task-1',
  moveId: 'move-1',
  title: 'Schedule movers',
  category: 'BEFORE_MOVE',
  dueDate: '2026-09-01T00:00:00.000Z',
  isComplete: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
});

function renderChecklist(routes = {}) {
  const mocks = mockApi({
    'GET /api/moves': [aMove()],
    'GET /api/tasks': [aTask()],
    ...routes,
  });
  renderWithProviders(<ChecklistPage />, { route: '/checklist' });
  return mocks;
}

describe('ChecklistPage', () => {
  it('shows a single empty state, not one per category', async () => {
    renderChecklist({ 'GET /api/tasks': [] });

    expect(await screen.findByText(/your checklist is empty/i)).toBeInTheDocument();
    expect(screen.queryByText('Before Move')).not.toBeInTheDocument();
    expect(screen.queryByText('Moving Day')).not.toBeInTheDocument();
  });

  it('groups tasks by category and hides categories with nothing in them', async () => {
    renderChecklist({
      'GET /api/tasks': [
        aTask({ id: 't1', title: 'Schedule movers', category: 'BEFORE_MOVE' }),
        aTask({ id: 't2', title: 'Final walkthrough', category: 'MOVING_DAY' }),
      ],
    });

    expect(await screen.findByText('Before Move')).toBeInTheDocument();
    expect(screen.getByText('Moving Day')).toBeInTheDocument();
    expect(screen.queryByText('After Move')).not.toBeInTheDocument();
  });

  it('counts progress across every category', async () => {
    renderChecklist({
      'GET /api/tasks': [
        aTask({ id: 't1', isComplete: true }),
        aTask({ id: 't2', isComplete: true, category: 'MOVING_DAY' }),
        aTask({ id: 't3', isComplete: false, category: 'AFTER_MOVE' }),
      ],
    });

    expect(await screen.findByText(/2 \/ 3 tasks complete/i)).toBeInTheDocument();
  });

  it('adds a task from the single input without requiring category or date', async () => {
    const user = userEvent.setup();
    const { calls } = renderChecklist({
      'POST /api/tasks': aTask({ id: 't-new', title: 'Cancel gym membership', dueDate: null }),
    });

    await screen.findByText('Schedule movers');
    await user.type(screen.getByPlaceholderText(/what needs to get done/i), 'Cancel gym membership');
    await user.click(screen.getByRole('button', { name: /\+ Add$/ }));

    expect(await screen.findByText('Cancel gym membership')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(post.body).toMatchObject({ title: 'Cancel gym membership', category: 'BEFORE_MOVE', dueDate: null });
  });

  it('keeps the add button disabled until there is something to add', async () => {
    const user = userEvent.setup();
    renderChecklist();
    await screen.findByText('Schedule movers');

    const addButton = screen.getByRole('button', { name: /\+ Add$/ });
    expect(addButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/what needs to get done/i), '   ');
    expect(addButton).toBeDisabled(); // whitespace alone is not a task

    await user.type(screen.getByPlaceholderText(/what needs to get done/i), 'Pack kitchen');
    expect(addButton).toBeEnabled();
  });

  it('reveals category and due date only when details are requested', async () => {
    const user = userEvent.setup();
    renderChecklist();
    await screen.findByText('Schedule movers');

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add details/i }));

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('ticks a task off immediately rather than waiting on the server', async () => {
    const user = userEvent.setup();
    let resolvePatch;
    renderChecklist({
      'PATCH /api/tasks': () =>
        new Promise((resolve) => {
          resolvePatch = () => resolve(aTask({ isComplete: true }));
        }),
    });

    await screen.findByText('Schedule movers');
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    // Optimistic: checked before the in-flight PATCH resolves.
    expect(checkbox).toBeChecked();
    resolvePatch();
    await waitFor(() => expect(checkbox).toBeChecked());
  });

  it('shows an error state when the checklist cannot be loaded', async () => {
    renderChecklist({ 'GET /api/tasks': errorResponse(500, 'Internal server error') });

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});
