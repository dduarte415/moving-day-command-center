import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/apiClient';
import { useMoveContext } from '../context/MoveContext';
import { Loading, ErrorState, EmptyState } from '../components/StatusStates';
import RowMenu from '../components/RowMenu';

const CATEGORIES = ['DEPOSIT', 'MOVERS', 'FURNITURE', 'SUPPLIES', 'OTHER'];

const currency = (n) =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BudgetPage() {
  const { activeMoveId } = useMoveContext();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ label: '', category: 'MOVERS', amount: '', isPaid: false });
  const [submitting, setSubmitting] = useState(false);

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

  if (status === 'loading') return <Loading label="Loading budget…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={load} />;

  const hasCap = summary?.budgetCap != null;
  const capExceeded = hasCap && summary.total > summary.budgetCap;
  const progressPct = hasCap ? Math.min(100, (summary.total / summary.budgetCap) * 100) : null;

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
        </section>
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
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
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
