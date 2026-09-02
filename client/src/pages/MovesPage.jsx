import { useEffect, useState } from 'react';
import { api } from '../lib/apiClient';
import { useMoveContext } from '../context/MoveContext';
import { Loading, ErrorState, EmptyState } from '../components/StatusStates';
import { formatDateLong, titleCaseAddress } from '../lib/formatDate';
import RowMenu from '../components/RowMenu';
import AddressAutocompleteInput from '../components/AddressAutocompleteInput';
import { CloseIcon } from '../components/NavIcons';

const emptyForm = { oldAddress: '', newAddress: '', moveDate: '', budgetCap: '' };

export default function MovesPage() {
  const { moves, status, error, refetchMoves, activeMoveId, activeMove, setActiveMoveId } = useMoveContext();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // Only a move-less first run should default to the form being open —
  // don't fight the user's own show/hide afterward.
  useEffect(() => {
    if (status === 'ready' && moves.length === 0) setShowForm(true);
  }, [status, moves.length]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return; // guards against double-click/double-submit
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await api.post('/api/moves', {
        oldAddress: form.oldAddress,
        newAddress: form.newAddress,
        moveDate: form.moveDate,
        budgetCap: form.budgetCap === '' ? null : form.budgetCap,
      });
      setForm(emptyForm);
      setShowForm(false);
      await refetchMoves();
      setActiveMoveId(created.id);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this move and all its tasks/budget items? This cannot be undone.')) return;
    try {
      await api.delete(`/api/moves/${id}`);
      await refetchMoves();
    } catch (err) {
      window.alert(err.message);
    }
  }

  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetchMoves} />;

  const otherMoves = moves.filter((m) => m.id !== activeMoveId);

  return (
    <div className="space-y-6">
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          + New move
        </button>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Start a new move</h2>
              <p className="mt-1 text-sm text-slate-500">
                Creates the move and seeds a default task checklist automatically.
              </p>
            </div>
            {moves.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Cancel"
                className="text-slate-400 hover:text-slate-600"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Old address</span>
              <AddressAutocompleteInput
                required
                value={form.oldAddress}
                onChange={(v) => setForm({ ...form, oldAddress: v })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="123 Elm St, Springfield, IL"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">New address</span>
              <AddressAutocompleteInput
                required
                value={form.newAddress}
                onChange={(v) => setForm({ ...form, newAddress: v })}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="456 Oak Ave, Austin, TX"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Move date</span>
              <input
                required
                type="date"
                value={form.moveDate}
                onChange={(e) => setForm({ ...form, moveDate: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Budget cap (optional)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.budgetCap}
                onChange={(e) => setForm({ ...form, budgetCap: e.target.value })}
                className="rounded-md border border-slate-300 px-3 py-2"
                placeholder="3000"
              />
            </label>

            {formError && <p className="sm:col-span-2 text-sm text-red-600">{formError}</p>}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  submitting
                    ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                    : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                {submitting ? 'Creating…' : 'Create move'}
              </button>
            </div>
          </form>
        </section>
      )}

      {activeMove && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current move</p>
          <p className="mt-1 font-medium text-slate-900">
            {titleCaseAddress(activeMove.oldAddress)} → {titleCaseAddress(activeMove.newAddress)}
          </p>
          <p className="text-sm text-slate-500">
            {formatDateLong(activeMove.moveDate)}
            {activeMove.budgetCap != null && ` · Budget cap ${Number(activeMove.budgetCap).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`}
          </p>
        </section>
      )}

      {moves.length === 0 && !showForm && (
        <EmptyState title="No moves yet" description="Create your first move above to get started." />
      )}

      {otherMoves.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Other moves
          </h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {otherMoves.map((move) => (
              <li key={move.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {titleCaseAddress(move.oldAddress)} → {titleCaseAddress(move.newAddress)}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateLong(move.moveDate)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveMoveId(move.id)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                  >
                    Switch to
                  </button>
                  <RowMenu actions={[{ label: 'Delete', danger: true, onClick: () => handleDelete(move.id) }]} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
