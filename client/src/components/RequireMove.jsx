import { Navigate } from 'react-router-dom';
import { useMoveContext } from '../context/MoveContext';
import { Loading, ErrorState } from './StatusStates';

// Checklist/Budget/Provider-lookup pages all need an active move to operate
// against — this centralizes the loading/error/empty gate they'd otherwise
// each repeat.
export default function RequireMove({ children }) {
  const { status, error, moves, activeMoveId, refetchMoves } = useMoveContext();

  if (status === 'loading') return <Loading label="Loading your move…" />;
  if (status === 'error') {
    return <ErrorState message={error ?? 'Could not load moves'} onRetry={refetchMoves} />;
  }
  if (moves.length === 0 || !activeMoveId) {
    return <Navigate to="/moves" replace />;
  }
  return children;
}
