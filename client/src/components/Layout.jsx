import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useMoveContext } from '../context/MoveContext';
import { formatDateLong, formatCountdown, titleCaseAddress } from '../lib/formatDate';
import Logo, { LogoMark } from './Logo';
import { ChecklistIcon, BudgetIcon, WifiIcon, MovesIcon, ChevronIcon } from './NavIcons';

const navItems = [
  { to: '/checklist', label: 'Checklist', Icon: ChecklistIcon },
  { to: '/budget', label: 'Budget', Icon: BudgetIcon },
  { to: '/provider-lookup', label: 'Internet Providers', Icon: WifiIcon },
  { to: '/moves', label: 'Moves', Icon: MovesIcon },
];

const SIDEBAR_COLLAPSED_KEY = 'moving-day.sidebarCollapsed';

function linkClasses({ isActive }) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;
}

export default function Layout() {
  const { activeMove, moves, activeMoveId, setActiveMoveId } = useMoveContext();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  );

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }

  const countdown = activeMove ? formatCountdown(activeMove.moveDate) : null;

  return (
    <div className="flex min-h-screen">
      <aside
        className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-150 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div
          className={`flex items-center gap-2 px-4 py-5 ${
            collapsed ? 'flex-col' : 'justify-between'
          }`}
        >
          {collapsed ? <LogoMark className="h-8 w-8" /> : <Logo />}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronIcon className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} title={collapsed ? label : undefined} className={linkClasses}>
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        {!collapsed && moves.length > 1 && (
          <div className="border-t border-slate-200 p-3">
            <label className="mb-1.5 block px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Active move
            </label>
            <select
              aria-label="Active move"
              value={activeMoveId ?? ''}
              onChange={(e) => setActiveMoveId(e.target.value)}
              title={activeMove ? `${activeMove.oldAddress} → ${activeMove.newAddress}` : undefined}
              className="w-full truncate rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {moves.map((move) => (
                <option key={move.id} value={move.id}>
                  {titleCaseAddress(move.oldAddress)} → {titleCaseAddress(move.newAddress)}
                </option>
              ))}
            </select>
          </div>
        )}
      </aside>

      <div className="flex-1">
        <main className="mx-auto max-w-[960px] px-6 py-6">
          {activeMove && (
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Your move
              </p>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h1 className="text-xl font-semibold text-slate-900">
                  {formatDateLong(activeMove.moveDate)}
                </h1>
                {countdown && (
                  <span className="text-sm font-medium text-brand-600">{countdown}</span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {titleCaseAddress(activeMove.oldAddress)} → {titleCaseAddress(activeMove.newAddress)}
              </p>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
