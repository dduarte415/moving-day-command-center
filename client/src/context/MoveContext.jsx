import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/apiClient';

const MoveContext = createContext(null);
const ACTIVE_MOVE_KEY = 'moving-day.activeMoveId';

// Single-user MVP has no login, so "which move am I looking at" is just a
// locally-remembered selection rather than anything server-enforced — see
// the README's out-of-scope note on multi-user auth.
export function MoveProvider({ children }) {
  const [moves, setMoves] = useState([]);
  const [activeMoveId, setActiveMoveIdState] = useState(() =>
    localStorage.getItem(ACTIVE_MOVE_KEY)
  );
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);

  const setActiveMoveId = useCallback((id) => {
    setActiveMoveIdState(id);
    if (id) localStorage.setItem(ACTIVE_MOVE_KEY, id);
    else localStorage.removeItem(ACTIVE_MOVE_KEY);
  }, []);

  const refetchMoves = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await api.get('/api/moves');
      setMoves(data);
      setStatus('ready');
      setError(null);
      return data;
    } catch (err) {
      setError(err.message);
      setStatus('error');
      throw err;
    }
  }, []);

  useEffect(() => {
    refetchMoves().catch(() => {});
  }, [refetchMoves]);

  useEffect(() => {
    if (status !== 'ready') return;
    if (activeMoveId && moves.some((m) => m.id === activeMoveId)) return;
    setActiveMoveId(moves[0]?.id ?? null);
  }, [status, moves, activeMoveId, setActiveMoveId]);

  const activeMove = moves.find((m) => m.id === activeMoveId) ?? null;

  const value = {
    moves,
    activeMove,
    activeMoveId,
    setActiveMoveId,
    status,
    error,
    refetchMoves,
  };

  return <MoveContext.Provider value={value}>{children}</MoveContext.Provider>;
}

export function useMoveContext() {
  const ctx = useContext(MoveContext);
  if (!ctx) throw new Error('useMoveContext must be used within a MoveProvider');
  return ctx;
}
