import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, renderWithProviders, aMove, errorResponse } from '../test/helpers';
import { useMoveContext } from './MoveContext';

// Minimal consumer — exercises the context itself rather than any one page.
function MoveProbe() {
  const { moves, activeMove, activeMoveId, status, error, setActiveMoveId } = useMoveContext();
  // Values go in data-testid nodes rather than concatenated strings — React
  // splits `label: {value}` into separate text nodes, which makes
  // getByText('label: value') brittle for empty/null values.
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="error">{String(error)}</p>
      <p data-testid="count">{moves.length}</p>
      <p data-testid="active">{String(activeMoveId)}</p>
      <p data-testid="activeAddress">{String(activeMove?.newAddress)}</p>
      {moves.map((m) => (
        <button key={m.id} onClick={() => setActiveMoveId(m.id)}>
          switch {m.id}
        </button>
      ))}
    </div>
  );
}

const ACTIVE_MOVE_KEY = 'moving-day.activeMoveId';

describe('MoveProvider', () => {
  it('auto-selects the first move when nothing is remembered', async () => {
    mockApi({ 'GET /api/moves': [aMove({ id: 'move-a' }), aMove({ id: 'move-b' })] });
    renderWithProviders(<MoveProbe />);

    // Wait on the value under test, not on `status` — the active move is
    // chosen in an effect that runs a tick after status flips to 'ready',
    // so asserting off `status` is a race that only shows up under load.
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('move-a'));
  });

  it('restores the remembered move instead of defaulting to the first', async () => {
    localStorage.setItem(ACTIVE_MOVE_KEY, 'move-b');
    mockApi({ 'GET /api/moves': [aMove({ id: 'move-a' }), aMove({ id: 'move-b' })] });
    renderWithProviders(<MoveProbe />);

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('move-b'));
  });

  it('persists a switch so it survives a reload', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /api/moves': [aMove({ id: 'move-a' }), aMove({ id: 'move-b' })] });
    renderWithProviders(<MoveProbe />);
    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('move-a'));

    await user.click(screen.getByRole('button', { name: 'switch move-b' }));

    expect(screen.getByTestId('active')).toHaveTextContent('move-b');
    expect(localStorage.getItem(ACTIVE_MOVE_KEY)).toBe('move-b');
  });

  it('falls back to the first move when the remembered one no longer exists', async () => {
    // e.g. the remembered move was deleted from another tab or session.
    localStorage.setItem(ACTIVE_MOVE_KEY, 'deleted-move');
    mockApi({ 'GET /api/moves': [aMove({ id: 'move-a' })] });
    renderWithProviders(<MoveProbe />);

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('move-a'));
    expect(localStorage.getItem(ACTIVE_MOVE_KEY)).toBe('move-a');
  });

  it('clears the active move when every move is gone', async () => {
    localStorage.setItem(ACTIVE_MOVE_KEY, 'move-a');
    mockApi({ 'GET /api/moves': [] });
    renderWithProviders(<MoveProbe />);

    await waitFor(() => expect(screen.getByTestId('active')).toHaveTextContent('null'));
    expect(screen.getByTestId('status')).toHaveTextContent('ready');
    expect(localStorage.getItem(ACTIVE_MOVE_KEY)).toBeNull();
  });

  it('surfaces a load failure as an error status without crashing', async () => {
    mockApi({ 'GET /api/moves': errorResponse(500, 'Internal server error') });
    renderWithProviders(<MoveProbe />);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
    expect(screen.getByTestId('error')).toHaveTextContent('Internal server error');
  });
});
