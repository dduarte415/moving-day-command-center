import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/apiClient';
import { useMoveContext } from '../context/MoveContext';
import { Loading, ErrorState, EmptyState } from '../components/StatusStates';
import RowMenu from '../components/RowMenu';
import { BulbIcon, PlusIcon } from '../components/NavIcons';
import { SUGGESTED_BUDGET_ITEMS, getBudgetTip } from '../lib/budgetSuggestions';
import LeftoverTracker from '../components/LeftoverTracker';

const CATEGORIES = ['DEPOSIT', 'MOVERS', 'FURNITURE', 'SUPPLIES', 'OTHER'];

const currency = (n) =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BudgetPage() {
  const { activeMoveId, activeMove, refetchMoves } = useMoveContext();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ label: '', category: 'MOVERS', amount: '', isPaid: false });
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await api.get(`/api/budget-items?moveId=${activeMoveId}`);
      setItems(data.items);
      setSummary(data.summary);
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [activeMoveId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { item, summary: newSummary } = await api.post('/api/budget-items', {
        moveId: activeMoveId,
        label: form.label,
        category: form.category,
        amount: form.amount,
        isPaid: form.isPaid,
      });
      setItems((prev) => [...prev, item]);
      setSummary(newSummary); // server-computed — never derived client-side (security req #10)
      setForm({ label: '', category: 'MOVERS', amount: '', isPaid: false });
    } catch (err) {
      window.alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePaid(item) {
    try {
      const { item: updated, summary: newSummary } = await api.patch(`/api/budget-items/${item.id}`, {
        isPaid: !item.isPaid,
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      setSummary(newSummary);
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleDelete(itemId) {
    if (!window.confirm('Delete this budget item? This cannot be undone.')) return;
    try {
      const { summary: newSummary } = await api.delete(`/api/budget-items/${itemId}`);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setSummary(newSummary);
    } catch (err) {
      window.alert(err.message);
    }
  }

  function applySuggestion(suggestion) {
    setForm((prev) => ({ ...prev, label: suggestion.label, category: suggestion.category }));
    amountRef.current?.focus();
  }

  if (status === 'loading') return <Loading label="Loading budget…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={load} />;

  const hasCap = summary?.budgetCap != null;
  const capExceeded = hasCap && summary.total > summary.budgetCap;
  const progressPct = hasCap ? Math.min(100, (summary.total / summary.budgetCap) * 100) : null;
  const addedLabels = new Set(items.map((i) => i.label.toLowerCase()));
  const suggestions = SUGGESTED_BUDGET_ITEMS.filter((s) => !addedLabels.has(s.label.toLowerCase())).slice(0, 4);
  const tip = summary ? getBudgetTip({ items, summary }) : null;

  return (
    <div className="space-y-6">
      {summary && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          {hasCap ? (
            <p className="text-sm text-slate-600">
              <span className="text-lg font-semibold text-slate-900">{currency(summary.total)}</span>
              {' spent of '}
              <span className="font-medium text-slate-800">{currency(summary.budgetCap)}</span>
              {' · '}
              <span className={capExceeded ? 'font-medium text-red-600' : ''}>
                {capExceeded
                  ? `${currency(summary.total - summary.budgetCap)} over budget`
                  : `${currency(summary.budgetCap - summary.total)} remaining`}
              </span>
            </p>
          ) : (
            <p className="text-lg font-semibold text-slate-900">{currency(summary.total)} spent</p>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            {currency(summary.paidTotal)} paid · {currency(summary.unpaidTotal)} unpaid
          </p>
          {progressPct != null && (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${capExceeded ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
          {tip && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
              <BulbIcon className="h-4 w-4 shrink-0 text-brand-500" />
              {tip}
            </p>
          )}
        </section>
      )}

      {activeMove && (
        <LeftoverTracker
          move={activeMove}
          onSaved={refetchMoves}
          movingCostsUnpaid={summary?.unpaidTotal ?? 0}
        />
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Quick add:</span>
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => applySuggestion(s)}
              title={s.hint ?? undefined}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
            >
              <PlusIcon className="h-3 w-3" />
              {s.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex flex-1 min-w-40 flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Item</span>
          <input
            required
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="e.g. Moving truck rental"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Category</span>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Amount</span>
          <input
            ref={amountRef}
            required
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-28 rounded-md border border-slate-300 px-3 py-2"
            placeholder="0.00"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPaid}
            onChange={(e) => setForm({ ...form, isPaid: e.target.checked })}
            className="h-4 w-4 accent-brand-600"
          />
          Paid
        </label>
        <button
          type="submit"
          disabled={submitting}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            submitting
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
        >
          {submitting ? 'Adding…' : 'Add item'}
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No budget items yet" description="Add your first line item above." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-400">
                  {item.category.charAt(0) + item.category.slice(1).toLowerCase()}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-slate-700">{currency(item.amount)}</span>
              <button
                type="button"
                onClick={() => togglePaid(item)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  item.isPaid
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {item.isPaid ? 'Paid ✓' : 'Unpaid'}
              </button>
              <RowMenu actions={[{ label: 'Delete', danger: true, onClick: () => handleDelete(item.id) }]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
