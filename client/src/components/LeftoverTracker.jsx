import { useState } from 'react';
import { api } from '../lib/apiClient';

const currency = (n) =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// "What's actually left over after rent?" — a small planning aid next to the
// moving budget. Income and rent are stored on the move (monthlyIncome /
// monthlyRent); everything shown here is derived on the fly, so there's no
// second source of truth to keep in sync. The yearly view is deliberately a
// plain ×12 of the monthly figures, not a separate model — the honest scope
// is "roughly what will this cost me over a year", not real forecasting.
export default function LeftoverTracker({ move, onSaved, movingCostsUnpaid }) {
  const [view, setView] = useState('month'); // 'month' | 'year'
  const [editing, setEditing] = useState(false);
  const [income, setIncome] = useState(move.monthlyIncome ?? '');
  const [rent, setRent] = useState(move.monthlyRent ?? '');
  const [saving, setSaving] = useState(false);

  const hasData = move.monthlyIncome != null && move.monthlyRent != null;

  async function save(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const updated = await api.patch(`/api/moves/${move.id}`, {
        monthlyIncome: income === '' ? null : income,
        monthlyRent: rent === '' ? null : rent,
      });
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      window.alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!hasData && !editing) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-4">
        <p className="text-sm font-medium text-slate-700">Track what's left after rent</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Add your monthly income and rent to see what you'll have left over each month and across the year.
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          Set up
        </button>
      </section>
    );
  }

  if (editing) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <form onSubmit={save} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Monthly income</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
              className="w-36 rounded-md border border-slate-300 px-3 py-2"
              placeholder="5000"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Monthly rent</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
              className="w-36 rounded-md border border-slate-300 px-3 py-2"
              placeholder="1800"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              saving ? 'cursor-not-allowed bg-gray-200 text-gray-400' : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-2 py-2 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </form>
      </section>
    );
  }

  const multiplier = view === 'year' ? 12 : 1;
  const incomeAmt = Number(move.monthlyIncome) * multiplier;
  const rentAmt = Number(move.monthlyRent) * multiplier;
  const leftover = incomeAmt - rentAmt;
  const rentPct = incomeAmt > 0 ? Math.min(100, (rentAmt / incomeAmt) * 100) : 0;
  const negative = leftover < 0;

  // How the still-unpaid moving costs sit against a single period's leftover —
  // the actual question someone asks when planning a move.
  const coversMovingCosts = movingCostsUnpaid > 0 && leftover > 0
    ? leftover >= movingCostsUnpaid
    : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          <span className={`text-lg font-semibold ${negative ? 'text-red-600' : 'text-slate-900'}`}>
            {currency(leftover)}
          </span>
          {negative ? ' short ' : ' left over '}
          <span className="text-slate-400">
            {view === 'year' ? 'this year' : 'per month'}
          </span>
        </p>
        <div className="flex items-center gap-1 rounded-md bg-slate-100 p-0.5 text-xs font-medium">
          {['month', 'year'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded px-2.5 py-1 transition-colors ${
                view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v === 'month' ? 'Month' : 'Year'}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-0.5 text-xs text-slate-400">
        {currency(incomeAmt)} income − {currency(rentAmt)} rent
        {rentPct > 0 && ` · rent is ${Math.round(rentPct)}% of income`}
      </p>

      <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${negative ? 'bg-red-500' : 'bg-slate-400'}`}
          style={{ width: `${rentPct}%` }}
          title="Rent"
        />
        <div className="h-full flex-1 bg-emerald-400" title="Left over" />
      </div>

      {coversMovingCosts !== null && (
        <p className="mt-3 text-xs text-slate-500">
          {coversMovingCosts
            ? `Your ${view === 'year' ? 'yearly' : 'monthly'} leftover covers the ${currency(movingCostsUnpaid)} still unpaid on this move.`
            : `You're ${currency(movingCostsUnpaid - leftover)} short of the ${currency(movingCostsUnpaid)} still unpaid on this move.`}
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setIncome(move.monthlyIncome ?? '');
          setRent(move.monthlyRent ?? '');
          setEditing(true);
        }}
        className="mt-3 text-xs font-medium text-slate-400 hover:text-slate-600"
      >
        Edit income & rent
      </button>
    </section>
  );
}
