import { useState } from 'react';
import { api } from '../lib/apiClient';
import { useMoveContext } from '../context/MoveContext';
import { Loading, ErrorState, EmptyState } from '../components/StatusStates';
import { formatDate } from '../lib/formatDate';

const emptyForm = { oldAddress: '', newAddress: '', moveDate: '', budgetCap: '' };

export default function MovesPage() {
  const { moves, status, error, refetchMoves, activeMoveId, setActiveMoveId } = useMoveContext();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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
    setDeletingId(id);
    try {
      await api.delete(`/api/moves/${id}`);
      await refetchMoves();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-800">Start a new move</h2>
        <p className="mt-1 text-sm text-slate-500">
          Creates the move and seeds a default task checklist automatically.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Old address</span>
            <input
              required
              value={form.oldAddress}
              onChange={(e) => setForm({ ...form, oldAddress: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2"
              placeholder="123 Elm St, Springfield, IL"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">New address</span>
            <input
              required
              value={form.newAddress}
              onChange={(e) => setForm({ ...form, newAddress: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2"
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
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create move'}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-800">Your moves</h2>
        <div className="mt-3">
          {status === 'loading' && <Loading />}
          {status === 'error' && <ErrorState message={error} onRetry={refetchMoves} />}
          {status === 'ready' && moves.length === 0 && (
            <EmptyState title="No moves yet" description="Create your first move above to get started." />
          )}
          {status === 'ready' && moves.length > 0 && (
            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {moves.map((move) => (
                <li key={move.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-800">
                      {move.oldAddress} → {move.newAddress}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatDate(move.moveDate)}
                      {move.budgetCap != null && ` · Budget cap $${Number(move.budgetCap).toLocaleString()}`}
                      {move.id === activeMoveId && ' · Active'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {move.id !== activeMoveId && (
                      <button
                        type="button"
                        onClick={() => setActiveMoveId(move.id)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        Switch to
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(move.id)}
                      disabled={deletingId === move.id}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === move.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
