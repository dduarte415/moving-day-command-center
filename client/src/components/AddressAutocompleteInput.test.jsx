import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import AddressAutocompleteInput from './AddressAutocompleteInput';
import { mockApi, errorResponse } from '../test/helpers';

const suggestion = (id, label) => ({ id, label });

// The component is controlled, so tests drive it through a tiny host that
// owns the value — same contract the real forms use.
function Host({ onValue }) {
  const [value, setValue] = useState('');
  return (
    <AddressAutocompleteInput
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
      placeholder="Street address"
    />
  );
}

describe('AddressAutocompleteInput', () => {
  it('does not query until the input is long enough to be worth a lookup', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({ 'GET /api/address-autocomplete': { suggestions: [] } });
    render(<Host />);

    await user.type(screen.getByPlaceholderText('Street address'), 'ab');

    await new Promise((r) => setTimeout(r, 400));
    expect(calls.length).toBe(0);
  });

  it('shows suggestions and fills the field when one is picked', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    mockApi({
      'GET /api/address-autocomplete': {
        suggestions: [suggestion('1', '456 Oakland Ave, Novato, CA 94945')],
      },
    });
    render(<Host onValue={onValue} />);

    await user.type(screen.getByPlaceholderText('Street address'), '456 oak');

    const option = await screen.findByRole('button', { name: /456 Oakland Ave/ }, { timeout: 3000 });
    await user.click(option);

    expect(onValue).toHaveBeenLastCalledWith('456 Oakland Ave, Novato, CA 94945');
    await waitFor(() => expect(screen.queryByRole('button', { name: /456 Oakland Ave/ })).not.toBeInTheDocument());
  });

  it('supports keyboard selection', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    mockApi({
      'GET /api/address-autocomplete': {
        suggestions: [suggestion('1', '1 First St'), suggestion('2', '2 Second St')],
      },
    });
    render(<Host onValue={onValue} />);

    const input = screen.getByPlaceholderText('Street address');
    await user.type(input, '123 main');
    await screen.findByRole('button', { name: '1 First St' }, { timeout: 3000 });

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onValue).toHaveBeenLastCalledWith('2 Second St');
  });

  it('closes the list on Escape without changing the typed value', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    mockApi({ 'GET /api/address-autocomplete': { suggestions: [suggestion('1', '1 First St')] } });
    render(<Host onValue={onValue} />);

    await user.type(screen.getByPlaceholderText('Street address'), '1 fir');
    await screen.findByRole('button', { name: '1 First St' }, { timeout: 3000 });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('button', { name: '1 First St' })).not.toBeInTheDocument());
    expect(screen.getByPlaceholderText('Street address')).toHaveValue('1 fir');
  });

  it('stays a usable plain input when the lookup fails', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /api/address-autocomplete': errorResponse(503, 'Service unavailable') });
    render(<Host />);

    const input = screen.getByPlaceholderText('Street address');
    await user.type(input, '456 oak');

    await new Promise((r) => setTimeout(r, 500));
    // Fail quiet: no error text, no lost keystrokes, no dropdown.
    expect(input).toHaveValue('456 oak');
    expect(screen.queryByText(/unavailable|error|failed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('ignores a slow response for an earlier keystroke', async () => {
    const user = userEvent.setup();
    // The lookup for the earlier, shorter query resolves last. Without the
    // out-of-order guard its stale results would replace the correct ones.
    mockApi({
      'GET /api/address-autocomplete': async ({ path }) => {
        if (path.includes('456%20oak%20st')) return { suggestions: [suggestion('2', '456 Oak St, Novato CA')] };
        await new Promise((r) => setTimeout(r, 600));
        return { suggestions: [suggestion('1', 'STALE RESULT') ] };
      },
    });
    render(<Host />);

    const input = screen.getByPlaceholderText('Street address');
    await user.type(input, '456 oak');
    await new Promise((r) => setTimeout(r, 320)); // let the first lookup fire
    await user.type(input, ' st');

    expect(await screen.findByRole('button', { name: /456 Oak St/ }, { timeout: 3000 })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 700)); // outlive the stale response
    expect(screen.queryByText('STALE RESULT')).not.toBeInTheDocument();
  });
});
