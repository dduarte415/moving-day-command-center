import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/apiClient';
import { useMoveContext } from '../context/MoveContext';
import { Loading, ErrorState, EmptyState } from '../components/StatusStates';
import { formatDate } from '../lib/formatDate';

const CATEGORIES = [
  { key: 'BEFORE_MOVE', label: 'Before Move' },
  { key: 'MOVING_DAY', label: 'Moving Day' },
  { key: 'AFTER_MOVE', label: 'After Move' },
];

export default function ChecklistPage() {
  const { activeMoveId } = useMoveContext();
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ title: '', category: 'BEFORE_MOVE', dueDate: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const data = await api.get(`/api/tasks?moveId=${activeMoveId}`);
      setTasks(data);
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [activeMoveId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleComplete(task) {
    // Optimistic update, reconciled by the PATCH response.
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, isComplete: !t.isComplete } : t)));
    try {
      await api.patch(`/api/tasks/${task.id}`, { isComplete: !task.isComplete });
    } catch (err) {
      window.alert(err.message);
      load();
    }
  }

  async function handleDelete(taskId) {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      window.alert(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const task = await api.post('/api/tasks', {
        moveId: activeMoveId,
        title: form.title,
        category: form.category,
        dueDate: form.dueDate || null,
      });
      setTasks((prev) => [...prev, task]);
      setForm({ title: '', category: 'BEFORE_MOVE', dueDate: '' });
    } catch (err) {
      window.alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading') return <Loading label="Loading checklist…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex flex-1 min-w-48 flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">New task</span>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="e.g. Cancel gym membership"
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
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Due date</span>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add task'}
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        {CATEGORIES.map((category) => {
          const items = tasks
            .filter((t) => t.category === category.key)
            .sort((a, b) => new Date(a.dueDate ?? 0) - new Date(b.dueDate ?? 0));
          return (
            <div key={category.key} className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-3 font-semibold text-slate-800">{category.label}</h3>
              {items.length === 0 ? (
                <p className="text-sm text-slate-400">No tasks yet</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((task) => (
                    <li key={task.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={task.isComplete}
                        onChange={() => toggleComplete(task)}
                        className="mt-0.5 h-4 w-4 accent-brand-600"
                      />
                      <div className="flex-1">
                        <p className={task.isComplete ? 'text-slate-400 line-through' : 'text-slate-700'}>
                          {task.title}
                        </p>
                        {task.dueDate && (
                          <p className="text-xs text-slate-400">
                            Due {formatDate(task.dueDate)}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className="text-slate-300 hover:text-red-500"
                        aria-label="Delete task"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {tasks.length === 0 && (
        <EmptyState title="No tasks yet" description="Add your first task above." />
      )}
    </div>
  );
}
