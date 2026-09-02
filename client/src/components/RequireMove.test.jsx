import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import RequireMove from './RequireMove';
import { mockApi, renderWithProviders, aMove, errorResponse } from '../test/helpers';

function renderGuarded() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/checklist"
        element={
          <RequireMove>
            <p>Checklist content</p>
          </RequireMove>
        }
      />
      <Route path="/moves" element={<p>Moves page</p>} />
    </Routes>,
    { route: '/checklist' }
  );
}

describe('RequireMove', () => {
  it('renders the guarded page once a move is active', async () => {
    mockApi({ 'GET /api/moves': [aMove()] });
    renderGuarded();

    expect(await screen.findByText('Checklist content')).toBeInTheDocument();
  });

  it('does not bounce a fresh session to /moves while the active move is being selected', async () => {
    // Regression: with no remembered move, MoveProvider picks the first one
    // in an effect that runs a tick after status flips to 'ready'. Treating
    // that gap as "no move" redirected to /moves and stranded the user
    // there even though a perfectly good move existed.
    localStorage.clear();
    mockApi({ 'GET /api/moves': [aMove()] });
    renderGuarded();

    expect(await screen.findByText('Checklist content')).toBeInTheDocument();
    expect(screen.queryByText('Moves page')).not.toBeInTheDocument();
  });

  it('sends a user with no moves at all to the moves page', async () => {
    mockApi({ 'GET /api/moves': [] });
    renderGuarded();

    expect(await screen.findByText('Moves page')).toBeInTheDocument();
  });

  it('offers a retry instead of redirecting when the move list fails to load', async () => {
    mockApi({ 'GET /api/moves': errorResponse(500, 'Internal server error') });
    renderGuarded();

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('Moves page')).not.toBeInTheDocument();
  });
});
