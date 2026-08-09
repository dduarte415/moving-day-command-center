import { NavLink, Outlet } from 'react-router-dom';
import { useMoveContext } from '../context/MoveContext';
import { formatDate } from '../lib/formatDate';

const navItems = [
  { to: '/checklist', label: 'Checklist' },
  { to: '/budget', label: 'Budget' },
  { to: '/provider-lookup', label: 'Internet Providers' },
  { to: '/moves', label: 'Moves' },
];

function linkClasses({ isActive }) {
  return `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;
}

export default function Layout() {
  const { activeMove, moves, activeMoveId, setActiveMoveId } = useMoveContext();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-brand-700">🏠 Moving Day Command Center</span>
            <nav className="flex flex-wrap gap-1">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClasses}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {moves.length > 0 && (
            <select
              aria-label="Active move"
              value={activeMoveId ?? ''}
              onChange={(e) => setActiveMoveId(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {moves.map((move) => (
                <option key={move.id} value={move.id}>
                  {move.oldAddress} → {move.newAddress}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {activeMove && (
          <p className="mb-4 text-sm text-slate-500">
            Move date <span className="font-medium text-slate-700">{formatDate(activeMove.moveDate)}</span>
            {' · '}
            {activeMove.oldAddress} → {activeMove.newAddress}
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
