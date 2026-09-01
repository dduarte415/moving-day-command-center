import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MoveProvider } from './context/MoveContext';
import Layout from './components/Layout';
import RequireMove from './components/RequireMove';
import MovesPage from './pages/MovesPage';
import ChecklistPage from './pages/ChecklistPage';
import BudgetPage from './pages/BudgetPage';
import NewAreaPage from './pages/NewAreaPage';

export default function App() {
  return (
    <BrowserRouter>
      <MoveProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/checklist" replace />} />
            <Route path="/moves" element={<MovesPage />} />
            <Route
              path="/checklist"
              element={
                <RequireMove>
                  <ChecklistPage />
                </RequireMove>
              }
            />
            <Route
              path="/budget"
              element={
                <RequireMove>
                  <BudgetPage />
                </RequireMove>
              }
            />
            <Route path="/new-area" element={<NewAreaPage />} />
            {/* Old path kept so existing links/bookmarks don't 404. */}
            <Route path="/provider-lookup" element={<Navigate to="/new-area" replace />} />
            <Route path="*" element={<Navigate to="/checklist" replace />} />
          </Route>
        </Routes>
      </MoveProvider>
    </BrowserRouter>
  );
}
